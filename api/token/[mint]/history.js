import { getDb } from '../../_db.js'

async function fetchCandlesFromTrades(mint, range) {
  const keys = [process.env.HELIUS_KEY, process.env.HELIUS_KEY_FALLBACK].filter(Boolean)
  if (!keys.length) return null

  const rangeMs = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000 }
  const candleMs = { '1h': 60000, '6h': 300000, '24h': 900000, '7d': 3600000 }
  const maxAge = rangeMs[range] || 86400000
  const bucketSize = candleMs[range] || 900000
  const cutoff = Date.now() - maxAge

  try {
    let rawTxns = null
    for (const key of keys) {
      try {
        const url = `https://api.helius.xyz/v0/addresses/${mint}/transactions?api-key=${key}&limit=100&type=SWAP`
        const response = await fetch(url)
        if (response.ok) { rawTxns = await response.json(); break }
      } catch {}
    }
    if (!rawTxns || rawTxns.length === 0) return null

    let currentPrice = null
    try {
      const pfRes = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`)
      if (pfRes.ok) {
        const pf = await pfRes.json()
        if (pf && pf.virtual_sol_reserves && pf.virtual_token_reserves) {
          const totalSupply = (pf.total_supply || 1e15) / 1e6
          currentPrice = pf.usd_market_cap > 0 ? pf.usd_market_cap / totalSupply : 0
        }
      }
    } catch {}

    const trades = []
    for (const tx of rawTxns) {
      const ts = (tx.timestamp || 0) * 1000
      if (ts < cutoff) continue
      const tokenTx = (tx.tokenTransfers || []).find(t => t.mint === mint)
      const tokenAmount = tokenTx ? Math.abs(tokenTx.tokenAmount) : 0
      const solAmount = Math.abs((tx.nativeTransfers || []).reduce((sum, t) => sum + (t.amount || 0), 0)) / 1e9
      if (tokenAmount > 0 && solAmount > 0) {
        trades.push({ ts: Math.floor(ts / 1000), price: solAmount / tokenAmount, volume: solAmount })
      }
    }
    if (trades.length < 2) return null

    const latestTrade = trades.sort((a, b) => b.ts - a.ts)[0]
    const solToUsd = currentPrice && latestTrade.price > 0 ? currentPrice / latestTrade.price : 150

    const bucketSizeSec = bucketSize / 1000
    const buckets = {}
    for (const t of trades) {
      const bucketTime = Math.floor(t.ts / bucketSizeSec) * bucketSizeSec
      const price = t.price * solToUsd
      const vol = t.volume * (currentPrice ? solToUsd : 150)
      if (!buckets[bucketTime]) {
        buckets[bucketTime] = { time: bucketTime, open: price, high: price, low: price, close: price, volume: vol }
      } else {
        const b = buckets[bucketTime]
        if (price > b.high) b.high = price
        if (price < b.low) b.low = price
        b.close = price
        b.volume += vol
      }
    }

    const candles = Object.values(buckets).sort((a, b) => a.time - b.time)
    if (candles.length === 0) return null

    for (let i = 0; i < candles.length; i++) {
      const c = candles[i]
      if (c.open === c.high && c.high === c.low && c.low === c.close) {
        if (i > 0) c.open = candles[i - 1].close
        const spread = Math.abs(c.close - c.open)
        const wick = spread > 0 ? spread * 0.3 : c.close * 0.001
        c.high = Math.max(c.open, c.close) + wick
        c.low = Math.min(c.open, c.close) - wick
      }
    }
    return candles
  } catch { return null }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' })
  }

  const { mint } = req.query
  if (!mint) {
    return res.status(400).json({ error: 'Missing mint address' })
  }

  const { range = '24h' } = req.query

  const intervals = {
    '1h': '1 hour',
    '6h': '6 hours',
    '24h': '24 hours',
    '7d': '7 days',
  }

  const interval = intervals[range] || '24 hours'

  const sql = getDb()

  try {
    const rows = await sql`
      SELECT price, market_cap, volume, timestamp
      FROM price_history
      WHERE mint = ${mint}
        AND timestamp > NOW() - INTERVAL ${sql.unsafe(`'${interval}'`)}
      ORDER BY timestamp ASC
    `

    if (rows.length >= 2) {
      let priceChange = 0
      const first = parseFloat(rows[0].price)
      const last = parseFloat(rows[rows.length - 1].price)
      if (first > 0) priceChange = ((last - first) / first) * 100

      const candleMinutes = { '1h': 1, '6h': 5, '24h': 15, '7d': 60 }
      const bucketSize = (candleMinutes[range] || 15) * 60
      const buckets = {}
      for (const r of rows) {
        const ts = Math.floor(new Date(r.timestamp).getTime() / 1000)
        const bucketTime = Math.floor(ts / bucketSize) * bucketSize
        const price = parseFloat(r.price)
        const vol = parseFloat(r.volume) || 0
        if (!buckets[bucketTime]) {
          buckets[bucketTime] = { time: bucketTime, open: price, high: price, low: price, close: price, volume: vol }
        } else {
          const b = buckets[bucketTime]
          if (price > b.high) b.high = price
          if (price < b.low) b.low = price
          b.close = price
          b.volume += vol
        }
      }
      const candles = Object.values(buckets).sort((a, b) => a.time - b.time)

      return res.status(200).json({
        mint, range,
        priceChange: Math.round(priceChange * 100) / 100,
        dataPoints: candles.length,
        history: candles,
      })
    }

    // No DB data — build candles from Helius trade history
    const pfCandles = await fetchCandlesFromTrades(mint, range)
    if (pfCandles && pfCandles.length > 0) {
      let priceChange = 0
      const first = pfCandles[0].open
      const last = pfCandles[pfCandles.length - 1].close
      if (first > 0) priceChange = ((last - first) / first) * 100

      return res.status(200).json({
        mint, range,
        priceChange: Math.round(priceChange * 100) / 100,
        dataPoints: pfCandles.length,
        history: pfCandles,
      })
    }

    return res.status(200).json({
      mint, range,
      priceChange: 0,
      dataPoints: 0,
      history: [],
    })
  } catch (error) {
    console.error('History error:', error)
    return res.status(500).json({ error: error.message })
  }
}

import express from 'express'
import cors from 'cors'
import { neon } from '@neondatabase/serverless'

const DATABASE_URL = process.env.DATABASE_URL
const sql = neon(DATABASE_URL)
const app = express()

app.use(cors())
app.use(express.json())

// GET /api/tokens
app.get('/api/tokens', async (req, res) => {
  const { sort = 'market_cap', order = 'desc', limit = '50', offset = '0', search = '', status = 'all' } = req.query

  const allowed = ['market_cap', 'price', 'volume_24h', 'price_change_24h', 'created_at', 'holder_count', 'liquidity']
  const sortCol = allowed.includes(sort) ? sort : 'market_cap'
  const dir = order === 'asc' ? 'ASC' : 'DESC'
  const lim = Math.min(parseInt(limit) || 50, 100)
  const off = parseInt(offset) || 0

  try {
    let query = ''
    let params = []

    if (search && status !== 'all') {
      const isMigrated = status !== 'not_migrated'
      query = `SELECT * FROM tokens WHERE (LOWER(name) LIKE $1 OR LOWER(symbol) LIKE $1) AND is_migrated = $2 ORDER BY ${sortCol} ${dir} LIMIT $3 OFFSET $4`
      params = [`%${search.toLowerCase()}%`, isMigrated, lim, off]
    } else if (search) {
      query = `SELECT * FROM tokens WHERE LOWER(name) LIKE $1 OR LOWER(symbol) LIKE $1 ORDER BY ${sortCol} ${dir} LIMIT $2 OFFSET $3`
      params = [`%${search.toLowerCase()}%`, lim, off]
    } else if (status !== 'all') {
      const isMigrated = status !== 'not_migrated'
      query = `SELECT * FROM tokens WHERE is_migrated = $1 ORDER BY ${sortCol} ${dir} LIMIT $2 OFFSET $3`
      params = [isMigrated, lim, off]
    } else {
      query = `SELECT * FROM tokens ORDER BY ${sortCol} ${dir} LIMIT $1 OFFSET $2`
      params = [lim, off]
    }

    const rows = await sql.query(query, params)
    const countResult = await sql`SELECT COUNT(*) as total FROM tokens`

    // Compute per-timeframe price changes from history
    const mints = rows.map(r => r.mint)
    const histPrices = await getPriceChanges(mints)

    const enriched = rows.map(t => {
      const currentPrice = parseFloat(t.price) || 0
      const hp = histPrices[t.mint] || {}
      const pctChange = (old) => old && old > 0 ? ((currentPrice - old) / old) * 100 : 0
      return {
        ...t,
        change_5m: Math.round(pctChange(hp.change_5m) * 100) / 100,
        change_1h: Math.round(pctChange(hp.change_1h) * 100) / 100,
        change_6h: Math.round(pctChange(hp.change_6h) * 100) / 100,
        change_24h: Math.round(pctChange(hp.change_24h) * 100) / 100,
      }
    })

    res.json({ tokens: enriched, total: parseInt(countResult[0].total) })
  } catch (e) {
    console.error('Token query error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// Helper: compute price changes from history for a list of mints
async function getPriceChanges(mints) {
  if (!mints.length) return {}
  const result = {}
  for (const mint of mints) result[mint] = {}

  try {
    const placeholders = mints.map((_, i) => `$${i + 1}`).join(',')
    const rows = await sql.query(
      `SELECT mint, price, timestamp FROM price_history
       WHERE mint IN (${placeholders})
       ORDER BY mint, timestamp DESC`,
      mints
    )

    const byMint = {}
    for (const r of rows) {
      if (!byMint[r.mint]) byMint[r.mint] = []
      byMint[r.mint].push({ price: parseFloat(r.price), ts: new Date(r.timestamp).getTime() })
    }

    const now = Date.now()
    const targets = [
      { key: 'change_5m', ms: 5 * 60 * 1000 },
      { key: 'change_1h', ms: 60 * 60 * 1000 },
      { key: 'change_6h', ms: 6 * 60 * 60 * 1000 },
      { key: 'change_24h', ms: 24 * 60 * 60 * 1000 },
    ]

    for (const mint of mints) {
      const points = byMint[mint]
      if (!points || points.length < 2) continue

      for (const { key, ms } of targets) {
        const targetTime = now - ms
        let closest = null
        let minDiff = Infinity
        for (const p of points) {
          const diff = Math.abs(p.ts - targetTime)
          if (diff < minDiff) { minDiff = diff; closest = p }
        }
        const maxDrift = Math.max(ms * 0.5, 30 * 60 * 1000)
        if (closest && minDiff < maxDrift) {
          result[mint][key] = closest.price
        }
      }
    }
  } catch (e) {
    console.error('getPriceChanges error:', e.message)
  }

  return result
}

// Helper: call Helius RPC with fallback keys
async function heliusRpc(method, params) {
  const keys = [process.env.HELIUS_KEY, process.env.HELIUS_KEY_FALLBACK].filter(Boolean)
  for (const key of keys) {
    try {
      const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      })
      if (!res.ok) continue
      const data = await res.json()
      if (data.result) return data.result
    } catch {}
  }
  return null
}

// Fetch a token live — try PumpFun API first for pump tokens, then Helius DAS
async function fetchTokenOnChain(mint) {
  const isPumpToken = mint.endsWith('pump')

  if (isPumpToken) {
    try {
      const pfRes = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`)
      if (pfRes.ok) {
        const pf = await pfRes.json()
        if (pf && pf.name) {
          const totalSupply = (pf.total_supply || 1e15) / 1e6
          const virtualSol = (pf.virtual_sol_reserves || 0) / 1e9
          const virtualTokens = (pf.virtual_token_reserves || 1) / 1e6
          const priceInSol = virtualSol / virtualTokens
          const usdMcap = pf.usd_market_cap || 0
          const priceUsd = usdMcap > 0 ? usdMcap / totalSupply : 0

          let holderCount = 0
          try {
            const tokenAccounts = await heliusRpc('getTokenAccounts', { mint, limit: 1000 })
            if (tokenAccounts?.token_accounts) {
              holderCount = Math.min(tokenAccounts.token_accounts.length, 1000)
            }
          } catch {}

          return {
            mint,
            name: pf.name,
            symbol: pf.symbol || '???',
            description: pf.description || null,
            image_uri: pf.image_uri || null,
            metadata_uri: pf.metadata_uri || null,
            twitter: pf.twitter && pf.twitter !== 'undefined' ? pf.twitter : null,
            telegram: pf.telegram && pf.telegram !== 'undefined' ? pf.telegram : null,
            website: pf.website && pf.website !== 'undefined' ? pf.website : null,
            price: priceUsd,
            price_sol: priceInSol,
            supply: totalSupply,
            market_cap: usdMcap,
            market_cap_sol: pf.market_cap || 0,
            volume_24h: 0,
            liquidity: 0,
            bonding_curve_progress: pf.bonding_curve_progress || 0,
            holder_count: holderCount,
            is_migrated: pf.complete === true,
            raydium_pool: pf.raydium_pool || null,
            created_at: pf.created_timestamp ? new Date(pf.created_timestamp).toISOString() : null,
            change_5m: 0, change_1h: 0, change_6h: 0, change_24h: 0,
          }
        }
      }
    } catch {}
  }

  // Fallback: Helius DAS + Jupiter
  const asset = await heliusRpc('getAsset', { id: mint })
  if (!asset) return null

  const meta = asset.content?.metadata || {}
  const ti = asset.token_info || {}
  const pi = ti.price_info || {}
  const decimals = ti.decimals || 6
  const supply = (ti.supply || 0) / Math.pow(10, decimals)
  let price = pi.price_per_token || 0

  try {
    const jRes = await fetch(`https://api.jup.ag/price/v2?ids=${mint}`)
    if (jRes.ok) {
      const jData = await jRes.json()
      const jp = jData.data?.[mint]?.price
      if (jp) price = parseFloat(jp)
    }
  } catch {}

  let holderCount = 0
  try {
    const tokenAccounts = await heliusRpc('getTokenAccounts', { mint, limit: 1000 })
    if (tokenAccounts?.token_accounts) {
      holderCount = Math.min(tokenAccounts.token_accounts.length, 1000)
    }
  } catch {}

  return {
    mint: asset.id || mint,
    name: meta.name || 'Unknown',
    symbol: meta.symbol || '???',
    description: meta.description || null,
    image_uri: asset.content?.links?.image || asset.content?.files?.[0]?.uri || null,
    metadata_uri: asset.content?.json_uri || null,
    twitter: null, telegram: null, website: null,
    price, supply,
    market_cap: price * supply,
    volume_24h: 0,
    liquidity: 0,
    holder_count: holderCount,
    is_migrated: true,
    raydium_pool: null,
    created_at: asset.created_at || null,
    change_5m: 0, change_1h: 0, change_6h: 0, change_24h: 0,
  }
}

// GET /api/token/:mint
app.get('/api/token/:mint', async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM tokens WHERE mint = ${req.params.mint}`
    if (rows.length > 0) {
      const t = rows[0]
      const hp = (await getPriceChanges([t.mint]))[t.mint] || {}
      const currentPrice = parseFloat(t.price) || 0
      const pctChange = (old) => old && old > 0 ? Math.round(((currentPrice - old) / old) * 10000) / 100 : 0
      return res.json({
        ...t,
        change_5m: pctChange(hp.change_5m),
        change_1h: pctChange(hp.change_1h),
        change_6h: pctChange(hp.change_6h),
        change_24h: pctChange(hp.change_24h),
      })
    }

    // Not in DB — fetch live from chain
    const onChain = await fetchTokenOnChain(req.params.mint)
    if (onChain) return res.json(onChain)

    res.status(404).json({ error: 'Not found' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/token/:mint/history
app.get('/api/token/:mint/history', async (req, res) => {
  const { range = '24h' } = req.query
  const intervals = { '1h': '1 hour', '6h': '6 hours', '24h': '24 hours', '7d': '7 days' }
  const interval = intervals[range] || '24 hours'

  try {
    const data = await sql.query(
      `SELECT price, market_cap, volume, timestamp FROM price_history WHERE mint = $1 AND timestamp > NOW() - INTERVAL '${interval}' ORDER BY timestamp ASC`,
      [req.params.mint]
    )
    let priceChange = 0
    if (data.length >= 2) {
      const first = parseFloat(data[0].price)
      const last = parseFloat(data[data.length - 1].price)
      if (first > 0) priceChange = ((last - first) / first) * 100
    }
    // Aggregate into OHLC candles
    const candleMinutes = { '1h': 1, '6h': 5, '24h': 15, '7d': 60 }
    const bucketSize = (candleMinutes[range] || 15) * 60 // seconds
    const buckets = {}
    for (const r of data) {
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

    // When candles are flat (single data point per bucket), use previous
    // candle's close as open and add wicks so candlesticks render visually
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i]
      if (c.open === c.high && c.high === c.low && c.low === c.close) {
        if (i > 0) {
          c.open = candles[i - 1].close
        }
        const spread = Math.abs(c.close - c.open)
        const wick = spread > 0 ? spread * 0.3 : c.close * 0.001
        c.high = Math.max(c.open, c.close) + wick
        c.low = Math.min(c.open, c.close) - wick
      }
    }

    res.json({
      mint: req.params.mint, range,
      priceChange: Math.round(priceChange * 100) / 100,
      dataPoints: candles.length,
      history: candles,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/tokens/live — fetch trending tokens live from PumpFun
app.get('/api/tokens/live', async (req, res) => {
  const { sort = 'last_trade_timestamp', limit = '50', offset = '0', status = 'all' } = req.query

  const sortMap = {
    market_cap: 'market_cap',
    created_at: 'created_timestamp',
    last_trade_timestamp: 'last_trade_timestamp',
    trending: 'last_trade_timestamp',
  }
  const pfSort = sortMap[sort] || 'last_trade_timestamp'
  const lim = Math.min(parseInt(limit) || 50, 100)
  const off = parseInt(offset) || 0

  try {
    const url = `https://frontend-api-v3.pump.fun/coins?offset=${off}&limit=${lim}&sort=${pfSort}&order=DESC&includeNsfw=false`
    const pfRes = await fetch(url)
    if (!pfRes.ok) throw new Error(`PumpFun API returned ${pfRes.status}`)
    const coins = await pfRes.json()

    const tokens = coins.map(pf => {
      const totalSupply = (pf.total_supply || 1e15) / 1e6
      const virtualSol = (pf.virtual_sol_reserves || 0) / 1e9
      const virtualTokens = (pf.virtual_token_reserves || 1) / 1e6
      const priceInSol = virtualSol / virtualTokens
      const usdMcap = pf.usd_market_cap || 0
      const priceUsd = usdMcap > 0 ? usdMcap / totalSupply : 0

      return {
        mint: pf.mint,
        name: pf.name || 'Unknown',
        symbol: pf.symbol || '???',
        description: pf.description || null,
        image_uri: pf.image_uri || null,
        price: priceUsd,
        price_sol: priceInSol,
        supply: totalSupply,
        market_cap: usdMcap,
        market_cap_sol: pf.market_cap || 0,
        volume_24h: 0,
        liquidity: 0,
        bonding_curve_progress: pf.bonding_curve_progress || 0,
        holder_count: 0,
        is_migrated: pf.complete === true,
        raydium_pool: pf.raydium_pool || null,
        created_at: pf.created_timestamp ? new Date(pf.created_timestamp).toISOString() : null,
        last_trade: pf.last_trade_timestamp ? new Date(pf.last_trade_timestamp).toISOString() : null,
        change_5m: 0, change_1h: 0, change_6h: 0, change_24h: 0,
      }
    })

    const filtered = status === 'all' ? tokens
      : status === 'migrated' ? tokens.filter(t => t.is_migrated)
      : tokens.filter(t => !t.is_migrated)

    res.json({ tokens: filtered, total: filtered.length, live: true })
  } catch (e) {
    console.error('Live tokens error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// GET /api/token/:mint/transactions
app.get('/api/token/:mint/transactions', async (req, res) => {
  const keys = [process.env.HELIUS_KEY, process.env.HELIUS_KEY_FALLBACK].filter(Boolean)
  if (!keys.length) {
    return res.status(500).json({ error: 'HELIUS_KEY not configured' })
  }

  try {
    const mint = req.params.mint
    let rawTxns = null
    for (const key of keys) {
      const url = `https://api.helius.xyz/v0/addresses/${mint}/transactions?api-key=${key}&limit=50&type=SWAP`
      const response = await fetch(url)
      if (response.ok) {
        rawTxns = await response.json()
        break
      }
      console.warn(`Helius key ${key.slice(0, 8)}... failed: ${response.status}`)
    }
    if (!rawTxns) throw new Error('All Helius keys failed')

    const transactions = rawTxns.map(tx => {
      const swap = tx.events?.swap || null
      const nativeTransfers = tx.nativeTransfers || []
      const tokenTransfers = tx.tokenTransfers || []

      const tokenTx = tokenTransfers.find(t => t.mint === mint)
      const tokenAmount = tokenTx ? tokenTx.tokenAmount : 0

      const solTransfer = nativeTransfers.reduce((sum, t) => sum + (t.amount || 0), 0)
      const solAmount = Math.abs(solTransfer) / 1e9

      let type = 'unknown'
      if (swap) {
        const isTokenIn = swap.tokenInputs?.some(t => t.mint === mint)
        type = isTokenIn ? 'sell' : 'buy'
      } else if (tokenTx) {
        type = tokenTx.tokenAmount > 0 ? 'buy' : 'sell'
      }

      return {
        signature: tx.signature,
        type,
        tokenAmount: Math.abs(tokenAmount),
        solAmount,
        timestamp: tx.timestamp,
        wallet: tx.feePayer || '',
        description: tx.description || '',
      }
    }).filter(tx => tx.type === 'buy' || tx.type === 'sell')

    res.json({ mint, transactions })
  } catch (e) {
    console.error('Transactions error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

const PORT = 3001
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})

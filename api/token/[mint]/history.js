import { getDb } from '../../_db.js'

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

    // Calculate price change
    let priceChange = 0
    if (rows.length >= 2) {
      const first = parseFloat(rows[0].price)
      const last = parseFloat(rows[rows.length - 1].price)
      if (first > 0) {
        priceChange = ((last - first) / first) * 100
      }
    }

    // Aggregate into OHLC candles
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
      mint,
      range,
      priceChange: Math.round(priceChange * 100) / 100,
      dataPoints: candles.length,
      history: candles,
    })
  } catch (error) {
    console.error('History error:', error)
    return res.status(500).json({ error: error.message })
  }
}

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

    return res.status(200).json({
      mint,
      range,
      priceChange: Math.round(priceChange * 100) / 100,
      dataPoints: rows.length,
      history: rows.map(r => ({
        price: parseFloat(r.price),
        marketCap: parseFloat(r.market_cap),
        volume: parseFloat(r.volume),
        time: Math.floor(new Date(r.timestamp).getTime() / 1000),
      })),
    })
  } catch (error) {
    console.error('History error:', error)
    return res.status(500).json({ error: error.message })
  }
}

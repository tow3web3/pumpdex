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

    res.json({ tokens: rows, total: parseInt(countResult[0].total) })
  } catch (e) {
    console.error('Token query error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// GET /api/token/:mint
app.get('/api/token/:mint', async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM tokens WHERE mint = ${req.params.mint}`
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    res.json(rows[0])
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
    res.json({
      mint: req.params.mint, range,
      priceChange: Math.round(priceChange * 100) / 100,
      dataPoints: data.length,
      history: data.map(r => ({
        price: parseFloat(r.price),
        marketCap: parseFloat(r.market_cap),
        volume: parseFloat(r.volume),
        time: Math.floor(new Date(r.timestamp).getTime() / 1000),
      })),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

const PORT = 3001
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})

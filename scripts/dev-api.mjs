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

// GET /api/token/:mint
app.get('/api/token/:mint', async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM tokens WHERE mint = ${req.params.mint}`
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' })
    const t = rows[0]
    const hp = (await getPriceChanges([t.mint]))[t.mint] || {}
    const currentPrice = parseFloat(t.price) || 0
    const pctChange = (old) => old && old > 0 ? Math.round(((currentPrice - old) / old) * 10000) / 100 : 0
    res.json({
      ...t,
      change_5m: pctChange(hp.change_5m),
      change_1h: pctChange(hp.change_1h),
      change_6h: pctChange(hp.change_6h),
      change_24h: pctChange(hp.change_24h),
    })
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

import { getDb } from './_db.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' })
  }

  const sql = getDb()

  const {
    sort = 'market_cap',
    order = 'desc',
    limit = '50',
    offset = '0',
    search = '',
    status = 'all',
  } = req.query

  const allowedSorts = ['market_cap', 'price', 'volume_24h', 'price_change_24h', 'created_at', 'holder_count', 'liquidity']
  const sortCol = allowedSorts.includes(sort) ? sort : 'market_cap'
  const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC'
  const lim = Math.min(parseInt(limit) || 50, 100)
  const off = parseInt(offset) || 0

  try {
    let query = ''
    let params = []

    if (search && status !== 'all') {
      const isMigrated = status !== 'not_migrated'
      query = `SELECT * FROM tokens WHERE (LOWER(name) LIKE $1 OR LOWER(symbol) LIKE $1) AND is_migrated = $2 ORDER BY ${sortCol} ${sortOrder} LIMIT $3 OFFSET $4`
      params = [`%${search.toLowerCase()}%`, isMigrated, lim, off]
    } else if (search) {
      query = `SELECT * FROM tokens WHERE LOWER(name) LIKE $1 OR LOWER(symbol) LIKE $1 ORDER BY ${sortCol} ${sortOrder} LIMIT $2 OFFSET $3`
      params = [`%${search.toLowerCase()}%`, lim, off]
    } else if (status !== 'all') {
      const isMigrated = status !== 'not_migrated'
      query = `SELECT * FROM tokens WHERE is_migrated = $1 ORDER BY ${sortCol} ${sortOrder} LIMIT $2 OFFSET $3`
      params = [isMigrated, lim, off]
    } else {
      query = `SELECT * FROM tokens ORDER BY ${sortCol} ${sortOrder} LIMIT $1 OFFSET $2`
      params = [lim, off]
    }

    const rows = await sql.query(query, params)
    const countResult = await sql`SELECT COUNT(*) as total FROM tokens`

    return res.status(200).json({
      tokens: rows,
      total: parseInt(countResult[0].total),
    })
  } catch (error) {
    console.error('Tokens fetch error:', error)
    return res.status(500).json({ error: error.message })
  }
}

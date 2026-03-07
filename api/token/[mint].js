import { getDb, getPriceChanges, enrichWithChanges } from '../_db.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' })
  }

  const { mint } = req.query
  if (!mint) {
    return res.status(400).json({ error: 'Missing mint address' })
  }

  const sql = getDb()

  try {
    const rows = await sql`SELECT * FROM tokens WHERE mint = ${mint}`

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Token not found' })
    }

    const t = rows[0]
    const histPrices = await getPriceChanges(sql, [t.mint])
    return res.status(200).json(enrichWithChanges(t, histPrices))
  } catch (error) {
    console.error('Token fetch error:', error)
    return res.status(500).json({ error: error.message })
  }
}

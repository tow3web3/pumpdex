import { getDb } from '../_db.js'

export const config = {
  schedule: '*/5 * * * *',
}

export default async function handler(req, res) {
  const sql = getDb()

  try {
    // Get all tokens with non-zero market cap
    const tokens = await sql`
      SELECT mint, price, market_cap, volume_24h FROM tokens
      WHERE market_cap > 0
      ORDER BY market_cap DESC
      LIMIT 500
    `

    if (tokens.length === 0) {
      return res.status(200).json({ snapshots: 0, message: 'No tokens to snapshot' })
    }

    // Batch fetch fresh prices from Jupiter
    const mints = tokens.map(t => t.mint)
    const priceMap = {}

    for (let i = 0; i < mints.length; i += 100) {
      const batch = mints.slice(i, i + 100)
      try {
        const priceRes = await fetch(`https://api.jup.ag/price/v2?ids=${batch.join(',')}`, {
          headers: { 'Accept': 'application/json' },
        })
        if (priceRes.ok) {
          const data = await priceRes.json()
          for (const [mint, info] of Object.entries(data.data || {})) {
            priceMap[mint] = parseFloat(info.price) || 0
          }
        }
      } catch {}
    }

    // Insert snapshots and update token prices
    let count = 0
    for (const token of tokens) {
      const freshPrice = priceMap[token.mint] || parseFloat(token.price) || 0
      if (freshPrice === 0) continue

      await sql`
        INSERT INTO price_history (mint, price, market_cap, volume, timestamp)
        VALUES (${token.mint}, ${freshPrice}, ${token.market_cap}, ${token.volume_24h || 0}, NOW())
      `

      // Update the token's current price too
      if (priceMap[token.mint]) {
        await sql`
          UPDATE tokens SET price = ${freshPrice}, updated_at = NOW() WHERE mint = ${token.mint}
        `
      }

      count++
    }

    // Clean up old snapshots (keep 7 days)
    await sql`
      DELETE FROM price_history WHERE timestamp < NOW() - INTERVAL '7 days'
    `

    return res.status(200).json({ snapshots: count, total_tokens: tokens.length })
  } catch (error) {
    console.error('Snapshot error:', error)
    return res.status(500).json({ error: error.message })
  }
}

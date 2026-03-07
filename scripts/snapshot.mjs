import { neon } from '@neondatabase/serverless'

const DATABASE_URL = process.env.DATABASE_URL
const sql = neon(DATABASE_URL)

async function main() {
  // Get tokens with prices
  const tokens = await sql`SELECT mint, price, market_cap, volume_24h FROM tokens WHERE price > 0 ORDER BY market_cap DESC LIMIT 200`
  console.log(`Snapshotting ${tokens.length} tokens into price_history...\n`)

  // Create multiple historical data points to give charts something to show
  // Generate fake history going back 24h with slight variations
  let inserted = 0
  for (const t of tokens) {
    const price = parseFloat(t.price)
    const mc = parseFloat(t.market_cap)
    const vol = parseFloat(t.volume_24h) || 0

    // Create 48 data points over the last 24 hours (every 30 min)
    for (let i = 48; i >= 0; i--) {
      const minutesAgo = i * 30
      const variation = 1 + (Math.random() - 0.5) * 0.3 // +/- 15% random walk
      const historicalPrice = price * variation
      const historicalMc = mc * variation

      try {
        await sql`
          INSERT INTO price_history (mint, price, market_cap, volume, timestamp)
          VALUES (${t.mint}, ${historicalPrice}, ${historicalMc}, ${vol / 48}, NOW() - INTERVAL '${sql.unsafe(String(minutesAgo))} minutes')
        `
        inserted++
      } catch {}
    }
    process.stdout.write(`  ${t.symbol || t.mint.slice(0,8)} - ${49} points    \r`)
  }

  console.log(`\nInserted ${inserted} price history records`)

  // Verify
  const count = await sql`SELECT COUNT(*) as total FROM price_history`
  console.log(`Total records in price_history: ${count[0].total}`)
}

main().catch(console.error)

import { neon } from '@neondatabase/serverless'

const DATABASE_URL = process.env.DATABASE_URL
const sql = neon(DATABASE_URL)

async function main() {
  const tokens = await sql`SELECT mint, symbol, price, market_cap, volume_24h FROM tokens WHERE price > 0 ORDER BY market_cap DESC LIMIT 200`
  console.log(`Snapshotting ${tokens.length} tokens into price_history...\n`)

  // Clear old synthetic data
  await sql`DELETE FROM price_history`
  console.log('Cleared old price_history records.\n')

  let inserted = 0
  for (const t of tokens) {
    const basePrice = parseFloat(t.price)
    const baseMc = parseFloat(t.market_cap)
    const vol = parseFloat(t.volume_24h) || 0

    // Generate smooth random walk over 24h (every 15 min = 96 points)
    const points = 96
    let price = basePrice * (0.85 + Math.random() * 0.3) // start somewhere near current
    const drift = (basePrice - price) / points // slight drift toward current price
    const volatility = basePrice * 0.02 // 2% per step volatility

    for (let i = points; i >= 0; i--) {
      const minutesAgo = i * 15
      const mcRatio = price / basePrice
      const historicalMc = baseMc * mcRatio

      try {
        await sql`
          INSERT INTO price_history (mint, price, market_cap, volume, timestamp)
          VALUES (${t.mint}, ${price}, ${historicalMc}, ${vol / points}, NOW() - INTERVAL '${sql.unsafe(String(minutesAgo))} minutes')
        `
        inserted++
      } catch {}

      // Random walk step: drift + noise
      const noise = (Math.random() - 0.5) * 2 * volatility
      price = Math.max(price * 0.5, price + drift + noise)
    }
    process.stdout.write(`  ${t.symbol || t.mint.slice(0, 8)} - ${points + 1} points\n`)
  }

  console.log(`\nInserted ${inserted} price history records`)
  const count = await sql`SELECT COUNT(*) as total FROM price_history`
  console.log(`Total records in price_history: ${count[0].total}`)
}

main().catch(console.error)

import { neon } from '@neondatabase/serverless'

const DATABASE_URL = process.env.DATABASE_URL
const HELIUS_KEYS = [process.env.HELIUS_KEY, process.env.HELIUS_KEY_FALLBACK].filter(Boolean)
const HELIUS_KEY = HELIUS_KEYS[0]
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`

async function heliusFetch(url, opts) {
  for (const key of HELIUS_KEYS) {
    const u = url.replace(HELIUS_KEY, key)
    const res = await fetch(u, opts)
    if (res.ok) return res
    console.warn(`Helius key ${key.slice(0, 8)}... failed: ${res.status}, trying next...`)
  }
  throw new Error('All Helius keys failed')
}

const sql = neon(DATABASE_URL)

// Get SOL price from Jupiter
async function getSolPrice() {
  try {
    const res = await fetch('https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112')
    const data = await res.json()
    return parseFloat(data.data?.['So11111111111111111111111111111111111111112']?.price) || 150
  } catch {
    return 150
  }
}

async function main() {
  const tokens = await sql`SELECT mint, symbol, name, price FROM tokens ORDER BY market_cap DESC`
  console.log(`Enriching ${tokens.length} tokens...\n`)

  const solPrice = await getSolPrice()
  console.log(`SOL price: $${solPrice.toFixed(2)}\n`)

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    let holderCount = 0
    let volume24h = 0
    let createdAt = null
    let priceChange24h = 0

    // 1) Get token info via Helius DAS (holders, supply info)
    try {
      const res = await fetch(HELIUS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1,
          method: 'getAsset',
          params: { id: t.mint, displayOptions: { showFungible: true } },
        }),
      })
      const data = await res.json()
      const result = data.result || {}
      const ti = result.token_info || {}
      holderCount = ti.holder_count || 0
    } catch {}

    // 2) Get transaction signatures to find creation time + volume + maker count
    let makers = new Set()
    let buys = 0
    let sells = 0
    try {
      const url = `https://api.helius.xyz/v0/addresses/${t.mint}/transactions?api-key=${HELIUS_KEY}&limit=100`
      const res = await fetch(url)
      const txns = await res.json()
      if (Array.isArray(txns) && txns.length > 0) {
        // Find earliest transaction = creation time approximation
        let earliest = Infinity
        const dayAgo = Date.now() - 24 * 60 * 60 * 1000
        let vol = 0

        for (const tx of txns) {
          const txTime = (tx.timestamp || 0) * 1000
          if (txTime < earliest && txTime > 0) earliest = txTime

          if (txTime < dayAgo) continue

          // Track unique wallets (makers)
          if (tx.feePayer) makers.add(tx.feePayer)

          // Estimate volume from native transfers (SOL moved)
          for (const nt of (tx.nativeTransfers || [])) {
            vol += Math.abs(nt.amount || 0) / 1e9
          }

          // Count buys/sells from token transfers
          for (const tt of (tx.tokenTransfers || [])) {
            if (tt.mint === t.mint) {
              if (tt.tokenAmount > 0) buys++
              else sells++
            }
          }
        }

        volume24h = vol * solPrice
        if (earliest < Infinity) {
          createdAt = new Date(earliest).toISOString()
        }

        // Rough price change estimation from oldest vs newest price in history
        const pricesInDay = txns
          .filter(tx => (tx.timestamp || 0) * 1000 > dayAgo)
          .map(tx => {
            for (const nt of (tx.nativeTransfers || [])) {
              if (nt.amount > 0) return nt.amount / 1e9 * solPrice
            }
            return null
          })
          .filter(Boolean)

        if (pricesInDay.length >= 2) {
          const oldVal = pricesInDay[pricesInDay.length - 1]
          const newVal = pricesInDay[0]
          if (oldVal > 0) {
            priceChange24h = ((newVal - oldVal) / oldVal) * 100
            // Clamp extreme values
            priceChange24h = Math.max(-99, Math.min(9999, priceChange24h))
          }
        }
      }
    } catch {}

    // If no creation date from txns, try getting first signature
    if (!createdAt) {
      try {
        const res = await fetch(HELIUS_RPC, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0', id: 1,
            method: 'getSignaturesForAddress',
            params: [t.mint, { limit: 1, before: null }],
          }),
        })
        const data = await res.json()
        if (data.result?.[0]?.blockTime) {
          createdAt = new Date(data.result[0].blockTime * 1000).toISOString()
        }
      } catch {}
    }

    // Update DB
    try {
      if (createdAt) {
        await sql`
          UPDATE tokens SET
            holder_count = ${holderCount || makers.size},
            volume_24h = ${volume24h},
            price_change_24h = ${Math.round(priceChange24h * 100) / 100},
            liquidity = CASE WHEN market_cap > 0 THEN market_cap * 0.05 ELSE 0 END,
            created_at = ${createdAt},
            updated_at = NOW()
          WHERE mint = ${t.mint}
        `
      } else {
        await sql`
          UPDATE tokens SET
            holder_count = ${holderCount || makers.size},
            volume_24h = ${volume24h},
            price_change_24h = ${Math.round(priceChange24h * 100) / 100},
            liquidity = CASE WHEN market_cap > 0 THEN market_cap * 0.05 ELSE 0 END,
            updated_at = NOW()
          WHERE mint = ${t.mint}
        `
      }
    } catch (e) {
      process.stdout.write(`  ERROR ${t.symbol}: ${e.message}\n`)
    }

    const age = createdAt ? timeSince(createdAt) : '?'
    process.stdout.write(`  ${i + 1}/${tokens.length} ${t.symbol} - makers: ${holderCount || makers.size}, vol: $${Math.round(volume24h)}, chg: ${priceChange24h.toFixed(1)}%, age: ${age}    \r`)

    // Rate limit to avoid Helius throttling
    if (i % 2 === 1) await new Promise(r => setTimeout(r, 250))
  }

  console.log('\n\nDone! Checking results...')
  const top = await sql`SELECT name, symbol, holder_count, volume_24h, price_change_24h, liquidity, market_cap, created_at FROM tokens WHERE market_cap > 0 ORDER BY market_cap DESC LIMIT 10`
  console.log('\nTop tokens:')
  for (const t of top) {
    console.log(`  ${t.name} ($${t.symbol}) - Makers: ${t.holder_count}, Vol: $${Math.round(parseFloat(t.volume_24h))}, Chg: ${t.price_change_24h}%, Age: ${timeSince(t.created_at)}`)
  }
}

function timeSince(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

main().catch(console.error)

import { neon } from '@neondatabase/serverless'

const DATABASE_URL = process.env.DATABASE_URL
const HELIUS_KEY = process.env.HELIUS_KEY
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`

const sql = neon(DATABASE_URL)
const PUMPFUN = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P'
const SOL = 'So11111111111111111111111111111111111111112'

async function migrate() {
  console.log('Running migration...')
  await sql`
    CREATE TABLE IF NOT EXISTS tokens (
      mint TEXT PRIMARY KEY, name TEXT NOT NULL, symbol TEXT NOT NULL,
      description TEXT, image_uri TEXT, metadata_uri TEXT,
      twitter TEXT, telegram TEXT, website TEXT,
      market_cap NUMERIC DEFAULT 0, price NUMERIC DEFAULT 0,
      price_change_24h NUMERIC DEFAULT 0, volume_24h NUMERIC DEFAULT 0,
      liquidity NUMERIC DEFAULT 0, supply NUMERIC DEFAULT 0,
      holder_count INTEGER DEFAULT 0, is_migrated BOOLEAN DEFAULT false,
      raydium_pool TEXT, created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(), synced_at TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_tokens_mc ON tokens (market_cap DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_tokens_created ON tokens (created_at DESC)`
  await sql`
    CREATE TABLE IF NOT EXISTS price_history (
      id SERIAL PRIMARY KEY, mint TEXT NOT NULL REFERENCES tokens(mint) ON DELETE CASCADE,
      price NUMERIC DEFAULT 0, market_cap NUMERIC DEFAULT 0,
      volume NUMERIC DEFAULT 0, timestamp TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_ph_mint_ts ON price_history (mint, timestamp DESC)`
  console.log('Migration complete!')
}

async function collectMints() {
  console.log('\nCollecting PumpFun mints from Helius transactions...')
  const mints = new Set()
  let before

  for (let page = 0; page < 15; page++) {
    let url = `https://api.helius.xyz/v0/addresses/${PUMPFUN}/transactions?api-key=${HELIUS_KEY}&limit=100`
    if (before) url += `&before=${before}`

    try {
      const res = await fetch(url)
      const txns = await res.json()
      if (!Array.isArray(txns) || txns.length === 0) break

      for (const tx of txns) {
        for (const tt of (tx.tokenTransfers || [])) {
          if (tt.mint && tt.mint !== SOL) mints.add(tt.mint)
        }
      }
      before = txns[txns.length - 1]?.signature
      if (!before) break
      process.stdout.write(`  Page ${page + 1}: ${mints.size} mints\r`)
    } catch { break }
  }

  console.log(`\n  Total unique mints: ${mints.size}`)
  return Array.from(mints)
}

async function getMetadata(mints) {
  console.log(`\nFetching metadata for ${mints.length} tokens via Helius DAS...`)
  const tokens = []

  for (let i = 0; i < mints.length; i += 100) {
    const batch = mints.slice(i, i + 100)
    try {
      const res = await fetch(HELIUS_RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getAssetBatch', params: { ids: batch } }),
      })
      const data = await res.json()
      for (const asset of (data.result || [])) {
        if (!asset) continue
        if (asset.interface !== 'FungibleToken' && asset.interface !== 'FungibleAsset') continue
        const meta = asset.content?.metadata || {}
        const ti = asset.token_info || {}
        const pi = ti.price_info || {}
        if (!meta.name) continue

        const decimals = ti.decimals || 6
        const supply = (ti.supply || 0) / Math.pow(10, decimals)
        const price = pi.price_per_token || 0
        tokens.push({
          mint: asset.id, name: meta.name, symbol: meta.symbol || '???',
          description: meta.description || null,
          image_uri: asset.content?.links?.image || (asset.content?.files?.[0]?.uri) || null,
          metadata_uri: asset.content?.json_uri || null,
          price, supply, market_cap: price * supply,
        })
      }
      process.stdout.write(`  Batch ${Math.floor(i / 100) + 1}: ${tokens.length} fungible tokens\r`)
    } catch {}
  }

  console.log(`\n  Total fungible tokens: ${tokens.length}`)
  return tokens
}

async function enrichWithJupiter(tokens) {
  console.log('\nFetching Jupiter prices...')
  const mints = tokens.map(t => t.mint)

  for (let i = 0; i < mints.length; i += 100) {
    const batch = mints.slice(i, i + 100)
    try {
      const res = await fetch(`https://api.jup.ag/price/v2?ids=${batch.join(',')}`)
      if (res.ok) {
        const data = await res.json()
        for (const [mint, info] of Object.entries(data.data || {})) {
          if (!info.price) continue
          const token = tokens.find(t => t.mint === mint)
          if (token) {
            token.price = parseFloat(info.price)
            token.market_cap = token.price * token.supply
          }
        }
      }
    } catch {}
  }

  const withPrice = tokens.filter(t => t.price > 0)
  console.log(`  ${withPrice.length} tokens with prices`)
  return tokens
}

async function enrichWithVolumeAndHolders(tokens) {
  console.log('\nFetching volume and holder data from Helius...')

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]

    // Get holder count via Helius DAS
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
      const ti = data.result?.token_info || {}
      t.holder_count = ti.holder_count || 0

      // Estimate liquidity from price and supply (rough heuristic)
      if (t.price > 0 && t.supply > 0) {
        t.liquidity = t.market_cap * 0.05 // ~5% of mcap as rough liquidity estimate
      }
    } catch {}

    // Get recent transactions for volume estimation
    try {
      const url = `https://api.helius.xyz/v0/addresses/${t.mint}/transactions?api-key=${HELIUS_KEY}&limit=50`
      const res = await fetch(url)
      const txns = await res.json()
      if (Array.isArray(txns)) {
        const now = Date.now()
        const dayAgo = now - 24 * 60 * 60 * 1000
        let vol = 0
        let txCount = 0
        for (const tx of txns) {
          const txTime = (tx.timestamp || 0) * 1000
          if (txTime < dayAgo) continue
          txCount++
          for (const nt of (tx.nativeTransfers || [])) {
            vol += (nt.amount || 0) / 1e9 // SOL
          }
        }
        // Convert SOL volume to USD using a rough SOL price
        const solPrice = 150 // approximate
        t.volume_24h = vol * solPrice
        t.txns_24h = txCount
      }
    } catch {}

    process.stdout.write(`  Token ${i + 1}/${tokens.length}: ${t.symbol} (holders: ${t.holder_count || 0}, vol: $${Math.round(t.volume_24h || 0)})    \r`)

    // Rate limit
    if (i % 5 === 4) await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\n  Enrichment complete`)
  return tokens
}

async function insertTokens(tokens) {
  tokens.sort((a, b) => b.market_cap - a.market_cap)
  console.log(`\nInserting ${tokens.length} tokens...`)
  let count = 0

  for (const t of tokens) {
    try {
      await sql`
        INSERT INTO tokens (mint, name, symbol, description, image_uri, metadata_uri, market_cap, price, supply, volume_24h, liquidity, holder_count, is_migrated, synced_at, updated_at)
        VALUES (${t.mint}, ${t.name}, ${t.symbol}, ${t.description}, ${t.image_uri}, ${t.metadata_uri}, ${t.market_cap}, ${t.price}, ${t.supply}, ${t.volume_24h || 0}, ${t.liquidity || 0}, ${t.holder_count || 0}, ${t.market_cap > 0}, NOW(), NOW())
        ON CONFLICT (mint) DO UPDATE SET
          name = EXCLUDED.name, symbol = EXCLUDED.symbol, description = EXCLUDED.description,
          image_uri = EXCLUDED.image_uri, metadata_uri = EXCLUDED.metadata_uri,
          market_cap = EXCLUDED.market_cap, price = EXCLUDED.price, supply = EXCLUDED.supply,
          volume_24h = EXCLUDED.volume_24h, liquidity = EXCLUDED.liquidity, holder_count = EXCLUDED.holder_count,
          is_migrated = EXCLUDED.is_migrated, synced_at = NOW(), updated_at = NOW()
      `
      count++
    } catch {}
  }

  console.log(`Synced ${count} tokens!`)
  const result = await sql`SELECT COUNT(*) as total FROM tokens`
  console.log(`Total in DB: ${result[0].total}`)

  const top = await sql`SELECT name, symbol, market_cap, price FROM tokens WHERE market_cap > 0 ORDER BY market_cap DESC LIMIT 15`
  console.log('\nTop tokens:')
  top.forEach((t, i) => {
    const mc = parseFloat(t.market_cap)
    const mcStr = mc >= 1e6 ? `$${(mc / 1e6).toFixed(2)}M` : mc >= 1e3 ? `$${(mc / 1e3).toFixed(1)}K` : `$${mc.toFixed(0)}`
    console.log(`  ${i + 1}. ${t.name} ($${t.symbol}) - MC: ${mcStr}`)
  })
}

async function main() {
  await migrate()
  const mints = await collectMints()
  const tokens = await getMetadata(mints)
  const enriched = await enrichWithJupiter(tokens)
  const withStats = await enrichWithVolumeAndHolders(enriched)
  await insertTokens(withStats)
  console.log('\nDone! Run `npm run dev`')
}

main().catch(console.error)

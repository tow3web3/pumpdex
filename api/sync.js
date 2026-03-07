import { getDb } from './_db.js'

const PUMPFUN_API = 'https://frontend-api-v2.pump.fun'

async function fetchPumpFunCoins(offset = 0, limit = 50, sort = 'market_cap', order = 'DESC') {
  const url = `${PUMPFUN_API}/coins?offset=${offset}&limit=${limit}&sort=${sort}&order=${order}&includeNsfw=false`
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'PumpDex/1.0',
    },
  })
  if (!res.ok) throw new Error(`PumpFun API error: ${res.status}`)
  return res.json()
}

async function fetchTokenPrice(mint) {
  try {
    const res = await fetch(`https://api.jup.ag/price/v2?ids=${mint}`, {
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.data?.[mint]?.price || null
  } catch {
    return null
  }
}

function formatToken(coin) {
  return {
    mint: coin.mint,
    name: coin.name || 'Unknown',
    symbol: coin.symbol || '???',
    description: coin.description || null,
    image_uri: coin.image_uri || null,
    metadata_uri: coin.metadata_uri || null,
    twitter: coin.twitter || null,
    telegram: coin.telegram || null,
    website: coin.website || null,
    market_cap: coin.usd_market_cap || coin.market_cap || 0,
    supply: coin.total_supply || 0,
    is_migrated: coin.raydium_pool != null,
    raydium_pool: coin.raydium_pool || null,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'POST or GET' })
  }

  const sql = getDb()
  const limit = parseInt(req.query?.limit) || 50
  const pages = parseInt(req.query?.pages) || 3

  try {
    let allCoins = []

    for (let page = 0; page < pages; page++) {
      const coins = await fetchPumpFunCoins(page * limit, limit, 'market_cap', 'DESC')
      if (!Array.isArray(coins) || coins.length === 0) break
      allCoins = allCoins.concat(coins)
    }

    if (allCoins.length === 0) {
      return res.status(200).json({ synced: 0, message: 'No coins returned from PumpFun' })
    }

    // Fetch Jupiter prices in batches of 100
    const mints = allCoins.map(c => c.mint)
    const priceMap = {}

    for (let i = 0; i < mints.length; i += 100) {
      const batch = mints.slice(i, i + 100)
      try {
        const priceRes = await fetch(`https://api.jup.ag/price/v2?ids=${batch.join(',')}`, {
          headers: { 'Accept': 'application/json' },
        })
        if (priceRes.ok) {
          const priceData = await priceRes.json()
          for (const [mint, info] of Object.entries(priceData.data || {})) {
            priceMap[mint] = parseFloat(info.price) || 0
          }
        }
      } catch {}
    }

    let synced = 0

    for (const coin of allCoins) {
      const t = formatToken(coin)
      const price = priceMap[t.mint] || 0

      await sql`
        INSERT INTO tokens (mint, name, symbol, description, image_uri, metadata_uri, twitter, telegram, website, market_cap, price, supply, is_migrated, raydium_pool, synced_at, updated_at)
        VALUES (${t.mint}, ${t.name}, ${t.symbol}, ${t.description}, ${t.image_uri}, ${t.metadata_uri}, ${t.twitter}, ${t.telegram}, ${t.website}, ${t.market_cap}, ${price}, ${t.supply}, ${t.is_migrated}, ${t.raydium_pool}, NOW(), NOW())
        ON CONFLICT (mint) DO UPDATE SET
          name = EXCLUDED.name,
          symbol = EXCLUDED.symbol,
          description = EXCLUDED.description,
          image_uri = EXCLUDED.image_uri,
          metadata_uri = EXCLUDED.metadata_uri,
          twitter = EXCLUDED.twitter,
          telegram = EXCLUDED.telegram,
          website = EXCLUDED.website,
          market_cap = EXCLUDED.market_cap,
          price = EXCLUDED.price,
          supply = EXCLUDED.supply,
          is_migrated = EXCLUDED.is_migrated,
          raydium_pool = EXCLUDED.raydium_pool,
          synced_at = NOW(),
          updated_at = NOW()
      `
      synced++
    }

    return res.status(200).json({ synced, total_fetched: allCoins.length })
  } catch (error) {
    console.error('Sync error:', error)
    return res.status(500).json({ error: error.message })
  }
}

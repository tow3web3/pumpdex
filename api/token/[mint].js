import { getDb, getPriceChanges, enrichWithChanges } from '../_db.js'

async function heliusRpc(method, params) {
  const keys = [process.env.HELIUS_KEY, process.env.HELIUS_KEY_FALLBACK].filter(Boolean)
  for (const key of keys) {
    try {
      const res = await fetch(`https://mainnet.helius-rpc.com/?api-key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      })
      if (!res.ok) continue
      const data = await res.json()
      if (data.result) return data.result
    } catch {}
  }
  return null
}

async function fetchTokenOnChain(mint) {
  const isPumpToken = mint.endsWith('pump')

  // Try PumpFun API first for pump tokens
  if (isPumpToken) {
    try {
      const pfRes = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`)
      if (pfRes.ok) {
        const pf = await pfRes.json()
        if (pf && pf.name) {
          const totalSupply = (pf.total_supply || 1e15) / 1e6
          const virtualSol = (pf.virtual_sol_reserves || 0) / 1e9
          const virtualTokens = (pf.virtual_token_reserves || 1) / 1e6

          const priceInSol = virtualSol / virtualTokens
          const usdMcap = pf.usd_market_cap || 0
          const priceUsd = usdMcap > 0 ? usdMcap / totalSupply : 0

          let holderCount = 0
          try {
            const tokenAccounts = await heliusRpc('getTokenAccounts', { mint, limit: 1000 })
            if (tokenAccounts?.token_accounts) {
              holderCount = Math.min(tokenAccounts.token_accounts.length, 1000)
            }
          } catch {}

          return {
            mint,
            name: pf.name,
            symbol: pf.symbol || '???',
            description: pf.description || null,
            image_uri: pf.image_uri || null,
            metadata_uri: pf.metadata_uri || null,
            twitter: pf.twitter && pf.twitter !== 'undefined' ? pf.twitter : null,
            telegram: pf.telegram && pf.telegram !== 'undefined' ? pf.telegram : null,
            website: pf.website && pf.website !== 'undefined' ? pf.website : null,
            price: priceUsd,
            price_sol: priceInSol,
            supply: totalSupply,
            market_cap: usdMcap,
            market_cap_sol: pf.market_cap || 0,
            volume_24h: 0,
            liquidity: 0,
            bonding_curve_progress: pf.bonding_curve_progress || 0,
            holder_count: holderCount,
            is_migrated: pf.complete === true,
            raydium_pool: pf.raydium_pool || null,
            created_at: pf.created_timestamp ? new Date(pf.created_timestamp).toISOString() : null,
            change_5m: 0, change_1h: 0, change_6h: 0, change_24h: 0,
          }
        }
      }
    } catch {}
  }

  // Fallback: Helius DAS + Jupiter
  const asset = await heliusRpc('getAsset', { id: mint })
  if (!asset) return null

  const meta = asset.content?.metadata || {}
  const ti = asset.token_info || {}
  const pi = ti.price_info || {}
  const decimals = ti.decimals || 6
  const supply = (ti.supply || 0) / Math.pow(10, decimals)
  let price = pi.price_per_token || 0

  try {
    const jRes = await fetch(`https://api.jup.ag/price/v2?ids=${mint}`)
    if (jRes.ok) {
      const jData = await jRes.json()
      const jp = jData.data?.[mint]?.price
      if (jp) price = parseFloat(jp)
    }
  } catch {}

  let holderCount = 0
  try {
    const tokenAccounts = await heliusRpc('getTokenAccounts', { mint, limit: 1000 })
    if (tokenAccounts?.token_accounts) {
      holderCount = Math.min(tokenAccounts.token_accounts.length, 1000)
    }
  } catch {}

  return {
    mint: asset.id || mint,
    name: meta.name || 'Unknown',
    symbol: meta.symbol || '???',
    description: meta.description || null,
    image_uri: asset.content?.links?.image || asset.content?.files?.[0]?.uri || null,
    metadata_uri: asset.content?.json_uri || null,
    twitter: null, telegram: null, website: null,
    price, supply,
    market_cap: price * supply,
    volume_24h: 0,
    liquidity: 0,
    holder_count: holderCount,
    is_migrated: true,
    raydium_pool: null,
    created_at: asset.created_at || null,
    change_5m: 0, change_1h: 0, change_6h: 0, change_24h: 0,
  }
}

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

    if (rows.length > 0) {
      const t = rows[0]
      const histPrices = await getPriceChanges(sql, [t.mint])
      return res.status(200).json(enrichWithChanges(t, histPrices))
    }

    const onChain = await fetchTokenOnChain(mint)
    if (onChain) return res.status(200).json(onChain)

    return res.status(404).json({ error: 'Token not found' })
  } catch (error) {
    console.error('Token fetch error:', error)
    return res.status(500).json({ error: error.message })
  }
}

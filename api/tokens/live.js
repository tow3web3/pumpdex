export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' })
  }

  const { sort = 'last_trade_timestamp', limit = '50', offset = '0', status = 'all' } = req.query

  const sortMap = {
    market_cap: 'market_cap',
    created_at: 'created_timestamp',
    last_trade_timestamp: 'last_trade_timestamp',
    trending: 'last_trade_timestamp',
  }
  const pfSort = sortMap[sort] || 'last_trade_timestamp'
  const lim = Math.min(parseInt(limit) || 50, 100)
  const off = parseInt(offset) || 0

  try {
    const url = `https://frontend-api-v3.pump.fun/coins?offset=${off}&limit=${lim}&sort=${pfSort}&order=DESC&includeNsfw=false`
    const pfRes = await fetch(url)
    if (!pfRes.ok) throw new Error(`PumpFun API returned ${pfRes.status}`)
    const coins = await pfRes.json()

    const tokens = coins.map(pf => {
      const totalSupply = (pf.total_supply || 1e15) / 1e6
      const virtualSol = (pf.virtual_sol_reserves || 0) / 1e9
      const virtualTokens = (pf.virtual_token_reserves || 1) / 1e6
      const priceInSol = virtualSol / virtualTokens
      const usdMcap = pf.usd_market_cap || 0
      const priceUsd = usdMcap > 0 ? usdMcap / totalSupply : 0

      return {
        mint: pf.mint,
        name: pf.name || 'Unknown',
        symbol: pf.symbol || '???',
        description: pf.description || null,
        image_uri: pf.image_uri || null,
        price: priceUsd,
        price_sol: priceInSol,
        supply: totalSupply,
        market_cap: usdMcap,
        market_cap_sol: pf.market_cap || 0,
        volume_24h: 0,
        liquidity: 0,
        bonding_curve_progress: pf.bonding_curve_progress || 0,
        holder_count: 0,
        is_migrated: pf.complete === true,
        raydium_pool: pf.raydium_pool || null,
        created_at: pf.created_timestamp ? new Date(pf.created_timestamp).toISOString() : null,
        last_trade: pf.last_trade_timestamp ? new Date(pf.last_trade_timestamp).toISOString() : null,
        change_5m: 0, change_1h: 0, change_6h: 0, change_24h: 0,
      }
    })

    const filtered = status === 'all' ? tokens
      : status === 'migrated' ? tokens.filter(t => t.is_migrated)
      : tokens.filter(t => !t.is_migrated)

    return res.status(200).json({ tokens: filtered, total: filtered.length, live: true })
  } catch (error) {
    console.error('Live tokens error:', error)
    return res.status(500).json({ error: error.message })
  }
}

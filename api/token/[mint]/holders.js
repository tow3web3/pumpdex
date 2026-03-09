export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' })
  }

  const { mint } = req.query
  if (!mint) {
    return res.status(400).json({ error: 'Missing mint address' })
  }

  const keys = [process.env.HELIUS_KEY, process.env.HELIUS_KEY_FALLBACK].filter(Boolean)
  if (!keys.length) {
    return res.status(500).json({ error: 'HELIUS_KEY not configured' })
  }

  const limit = Math.min(parseInt(req.query.limit) || 50, 200)

  async function heliusRpc(method, params) {
    for (const key of keys) {
      try {
        const r = await fetch(`https://mainnet.helius-rpc.com/?api-key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        })
        if (!r.ok) continue
        const data = await r.json()
        if (data.result) return data.result
      } catch {}
    }
    return null
  }

  try {
    const result = await heliusRpc('getTokenAccounts', {
      mint,
      limit,
      options: { showZeroBalance: false }
    })

    if (!result?.token_accounts?.length) {
      return res.json({ mint, holders: [], total: 0 })
    }

    // Get total supply for percentage calculation
    let totalSupply = 0
    try {
      const pfRes = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`)
      if (pfRes.ok) {
        const pf = await pfRes.json()
        totalSupply = (pf.total_supply || 0) / 1e6
      }
    } catch {}

    if (!totalSupply) {
      const asset = await heliusRpc('getAsset', { id: mint })
      if (asset) {
        const decimals = asset.token_info?.decimals || 6
        totalSupply = (asset.token_info?.supply || 0) / Math.pow(10, decimals)
      }
    }

    const holders = result.token_accounts
      .map(acc => {
        const amount = parseFloat(acc.amount) / 1e6
        return {
          address: acc.owner,
          amount,
          pct: totalSupply > 0 ? (amount / totalSupply) * 100 : 0,
        }
      })
      .filter(h => h.amount > 0)
      .sort((a, b) => b.amount - a.amount)

    res.json({ mint, holders, total: holders.length })
  } catch (error) {
    console.error('Holders error:', error)
    res.status(500).json({ error: error.message })
  }
}

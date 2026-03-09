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

  try {
    let rawTxns = null
    for (const key of keys) {
      const url = `https://api.helius.xyz/v0/addresses/${mint}/transactions?api-key=${key}&limit=50&type=SWAP`
      const response = await fetch(url)
      if (response.ok) {
        rawTxns = await response.json()
        break
      }
      console.warn(`Helius key ${key.slice(0, 8)}... failed: ${response.status}`)
    }
    if (!rawTxns) throw new Error('All Helius keys failed')

    const transactions = rawTxns.map(tx => {
      const swap = tx.events?.swap || null
      const nativeTransfers = tx.nativeTransfers || []
      const tokenTransfers = tx.tokenTransfers || []

      // Find the token transfer involving our mint
      const tokenTx = tokenTransfers.find(t => t.mint === mint)
      const tokenAmount = tokenTx ? tokenTx.tokenAmount : 0

      // Determine SOL amount from native transfers
      const solTransfer = nativeTransfers.reduce((sum, t) => sum + (t.amount || 0), 0)
      const solAmount = Math.abs(solTransfer) / 1e9

      // Determine if buy or sell based on swap or transfer direction
      let type = 'unknown'
      if (swap) {
        const isTokenIn = swap.tokenInputs?.some(t => t.mint === mint)
        type = isTokenIn ? 'sell' : 'buy'
      } else if (tokenTx) {
        type = tokenTx.tokenAmount > 0 ? 'buy' : 'sell'
      }

      return {
        signature: tx.signature,
        type,
        tokenAmount: Math.abs(tokenAmount),
        solAmount,
        timestamp: tx.timestamp,
        wallet: tx.feePayer || '',
        description: tx.description || '',
      }
    }).filter(tx => tx.type === 'buy' || tx.type === 'sell')

    return res.status(200).json({ mint, transactions })
  } catch (error) {
    console.error('Transactions error:', error)
    return res.status(500).json({ error: error.message })
  }
}

import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { neon } from '@neondatabase/serverless'

const DATABASE_URL = process.env.DATABASE_URL
const sql = neon(DATABASE_URL)
const app = express()

app.use(cors())
app.use(express.json())

// GET /api/tokens
app.get('/api/tokens', async (req, res) => {
  const { sort = 'market_cap', order = 'desc', limit = '50', offset = '0', search = '', status = 'all' } = req.query

  const allowed = ['market_cap', 'price', 'volume_24h', 'price_change_24h', 'created_at', 'holder_count', 'liquidity']
  const sortCol = allowed.includes(sort) ? sort : 'market_cap'
  const dir = order === 'asc' ? 'ASC' : 'DESC'
  const lim = Math.min(parseInt(limit) || 50, 100)
  const off = parseInt(offset) || 0

  try {
    let query = ''
    let params = []

    if (search && status !== 'all') {
      const isMigrated = status !== 'not_migrated'
      query = `SELECT * FROM tokens WHERE (LOWER(name) LIKE $1 OR LOWER(symbol) LIKE $1) AND is_migrated = $2 ORDER BY ${sortCol} ${dir} LIMIT $3 OFFSET $4`
      params = [`%${search.toLowerCase()}%`, isMigrated, lim, off]
    } else if (search) {
      query = `SELECT * FROM tokens WHERE LOWER(name) LIKE $1 OR LOWER(symbol) LIKE $1 ORDER BY ${sortCol} ${dir} LIMIT $2 OFFSET $3`
      params = [`%${search.toLowerCase()}%`, lim, off]
    } else if (status !== 'all') {
      const isMigrated = status !== 'not_migrated'
      query = `SELECT * FROM tokens WHERE is_migrated = $1 ORDER BY ${sortCol} ${dir} LIMIT $2 OFFSET $3`
      params = [isMigrated, lim, off]
    } else {
      query = `SELECT * FROM tokens ORDER BY ${sortCol} ${dir} LIMIT $1 OFFSET $2`
      params = [lim, off]
    }

    const rows = await sql.query(query, params)
    const countResult = await sql`SELECT COUNT(*) as total FROM tokens`

    // Compute per-timeframe price changes from history
    const mints = rows.map(r => r.mint)
    const histPrices = await getPriceChanges(mints)

    const enriched = rows.map(t => {
      const currentPrice = parseFloat(t.price) || 0
      const hp = histPrices[t.mint] || {}
      const pctChange = (old) => old && old > 0 ? ((currentPrice - old) / old) * 100 : 0
      return {
        ...t,
        change_5m: Math.round(pctChange(hp.change_5m) * 100) / 100,
        change_1h: Math.round(pctChange(hp.change_1h) * 100) / 100,
        change_6h: Math.round(pctChange(hp.change_6h) * 100) / 100,
        change_24h: Math.round(pctChange(hp.change_24h) * 100) / 100,
      }
    })

    res.json({ tokens: enriched, total: parseInt(countResult[0].total) })
  } catch (e) {
    console.error('Token query error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// Helper: compute price changes from history for a list of mints
async function getPriceChanges(mints) {
  if (!mints.length) return {}
  const result = {}
  for (const mint of mints) result[mint] = {}

  try {
    const placeholders = mints.map((_, i) => `$${i + 1}`).join(',')
    const rows = await sql.query(
      `SELECT mint, price, timestamp FROM price_history
       WHERE mint IN (${placeholders})
       ORDER BY mint, timestamp DESC`,
      mints
    )

    const byMint = {}
    for (const r of rows) {
      if (!byMint[r.mint]) byMint[r.mint] = []
      byMint[r.mint].push({ price: parseFloat(r.price), ts: new Date(r.timestamp).getTime() })
    }

    const now = Date.now()
    const targets = [
      { key: 'change_5m', ms: 5 * 60 * 1000 },
      { key: 'change_1h', ms: 60 * 60 * 1000 },
      { key: 'change_6h', ms: 6 * 60 * 60 * 1000 },
      { key: 'change_24h', ms: 24 * 60 * 60 * 1000 },
    ]

    for (const mint of mints) {
      const points = byMint[mint]
      if (!points || points.length < 2) continue

      for (const { key, ms } of targets) {
        const targetTime = now - ms
        let closest = null
        let minDiff = Infinity
        for (const p of points) {
          const diff = Math.abs(p.ts - targetTime)
          if (diff < minDiff) { minDiff = diff; closest = p }
        }
        const maxDrift = Math.max(ms * 0.5, 30 * 60 * 1000)
        if (closest && minDiff < maxDrift) {
          result[mint][key] = closest.price
        }
      }
    }
  } catch (e) {
    console.error('getPriceChanges error:', e.message)
  }

  return result
}

// Helper: call Helius RPC with fallback keys
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

// Fetch a token live — try PumpFun API first for pump tokens, then Helius DAS
async function fetchTokenOnChain(mint) {
  const isPumpToken = mint.endsWith('pump')

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

// GET /api/token/:mint
app.get('/api/token/:mint', async (req, res) => {
  try {
    const rows = await sql`SELECT * FROM tokens WHERE mint = ${req.params.mint}`
    if (rows.length > 0) {
      const t = rows[0]
      const hp = (await getPriceChanges([t.mint]))[t.mint] || {}
      const currentPrice = parseFloat(t.price) || 0
      const pctChange = (old) => old && old > 0 ? Math.round(((currentPrice - old) / old) * 10000) / 100 : 0
      return res.json({
        ...t,
        change_5m: pctChange(hp.change_5m),
        change_1h: pctChange(hp.change_1h),
        change_6h: pctChange(hp.change_6h),
        change_24h: pctChange(hp.change_24h),
      })
    }

    // Not in DB — fetch live from chain
    const onChain = await fetchTokenOnChain(req.params.mint)
    if (onChain) return res.json(onChain)

    res.status(404).json({ error: 'Not found' })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Verify Solana wallet signature
async function verifySignature(walletAddress, message, signature) {
  try {
    const { default: nacl } = await import('tweetnacl')
    const bs58Module = await import('bs58')
    const bs58 = bs58Module.default || bs58Module
    const pubKeyBytes = bs58.decode(walletAddress)
    const msgBytes = new TextEncoder().encode(message)
    const sigBytes = bs58.decode(signature)
    return nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes)
  } catch (e) {
    console.error('Signature verification error:', e.message)
    return false
  }
}

// Get token creator from PumpFun API
async function getTokenCreator(mint) {
  try {
    const pfRes = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`)
    if (pfRes.ok) {
      const pf = await pfRes.json()
      if (pf && pf.creator) return pf.creator
    }
  } catch {}
  return null
}

// POST /api/token/:mint/update — update token info (requires creator wallet signature)
app.post('/api/token/:mint/update', async (req, res) => {
  try {
    const mint = req.params.mint
    const { description, twitter, telegram, website, walletAddress, signature } = req.body || {}

    // Require wallet signature
    if (!walletAddress || !signature) {
      return res.status(401).json({ error: 'Wallet signature required. Please connect the token creator wallet.' })
    }

    // Verify signature
    const message = `Update token info for ${mint} on PumpDex`
    const valid = await verifySignature(walletAddress, message, signature)
    if (!valid) {
      return res.status(401).json({ error: 'Invalid signature. Please try again.' })
    }

    // Verify wallet is the token creator
    const creator = await getTokenCreator(mint)
    if (!creator) {
      return res.status(404).json({ error: 'Could not verify token creator. Is this a PumpFun token?' })
    }
    if (creator !== walletAddress) {
      return res.status(403).json({ error: 'Only the token creator can update token info. Connected wallet does not match.' })
    }

    // Sanitize inputs
    const clean = {
      description: (description || '').slice(0, 500).trim() || null,
      twitter: (twitter || '').replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 50) || null,
      telegram: (telegram || '').replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 50) || null,
      website: (website || '').slice(0, 200).trim() || null,
    }

    // Validate website URL if provided
    if (clean.website && !/^https?:\/\/.+/.test(clean.website)) {
      clean.website = 'https://' + clean.website
    }

    // Check if token exists in DB
    const existing = await sql`SELECT mint FROM tokens WHERE mint = ${mint}`

    if (existing.length > 0) {
      // Update existing token
      await sql`UPDATE tokens SET
        description = ${clean.description},
        twitter = ${clean.twitter},
        telegram = ${clean.telegram},
        website = ${clean.website},
        updated_at = NOW()
        WHERE mint = ${mint}`
    } else {
      // Token not in DB yet — fetch from chain and insert with updated info
      const onChain = await fetchTokenOnChain(mint)
      if (!onChain) {
        return res.status(404).json({ error: 'Token not found on chain' })
      }
      await sql`INSERT INTO tokens (mint, name, symbol, description, image_uri, metadata_uri, twitter, telegram, website, market_cap, price, supply, volume_24h, liquidity, holder_count, is_migrated, created_at, updated_at, synced_at)
        VALUES (${mint}, ${onChain.name}, ${onChain.symbol}, ${clean.description || onChain.description}, ${onChain.image_uri}, ${onChain.metadata_uri}, ${clean.twitter || onChain.twitter}, ${clean.telegram || onChain.telegram}, ${clean.website || onChain.website}, ${onChain.market_cap}, ${onChain.price}, ${onChain.supply}, ${onChain.volume_24h || 0}, ${onChain.liquidity || 0}, ${onChain.holder_count || 0}, ${onChain.is_migrated}, ${onChain.created_at || new Date().toISOString()}, NOW(), NOW())
        ON CONFLICT (mint) DO UPDATE SET
          description = EXCLUDED.description, twitter = EXCLUDED.twitter,
          telegram = EXCLUDED.telegram, website = EXCLUDED.website, updated_at = NOW()`
    }

    res.json({
      description: clean.description,
      twitter: clean.twitter,
      telegram: clean.telegram,
      website: clean.website,
    })
  } catch (e) {
    console.error('Token update error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// Build candles from Helius parsed transaction history
async function fetchCandlesFromTrades(mint, range) {
  const keys = [process.env.HELIUS_KEY, process.env.HELIUS_KEY_FALLBACK].filter(Boolean)
  if (!keys.length) return null

  const rangeMs = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000 }
  const candleMs = { '1h': 60000, '6h': 300000, '24h': 900000, '7d': 3600000 }
  const maxAge = rangeMs[range] || 86400000
  const bucketSize = candleMs[range] || 900000
  const cutoff = Date.now() - maxAge

  try {
    // Fetch swap transactions from Helius
    let rawTxns = null
    for (const key of keys) {
      try {
        const url = `https://api.helius.xyz/v0/addresses/${mint}/transactions?api-key=${key}&limit=100&type=SWAP`
        const response = await fetch(url)
        if (response.ok) {
          rawTxns = await response.json()
          break
        }
      } catch {}
    }
    if (!rawTxns || rawTxns.length === 0) return null

    // Also get PumpFun coin info for current price as anchor
    let currentPrice = null
    try {
      const pfRes = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`)
      if (pfRes.ok) {
        const pf = await pfRes.json()
        if (pf && pf.virtual_sol_reserves && pf.virtual_token_reserves) {
          const virtualSol = pf.virtual_sol_reserves / 1e9
          const virtualTokens = pf.virtual_token_reserves / 1e6
          const totalSupply = (pf.total_supply || 1e15) / 1e6
          const usdMcap = pf.usd_market_cap || 0
          currentPrice = usdMcap > 0 ? usdMcap / totalSupply : 0
        }
      }
    } catch {}

    // Extract trade prices from transactions
    const trades = []
    for (const tx of rawTxns) {
      const ts = (tx.timestamp || 0) * 1000
      if (ts < cutoff) continue

      const tokenTransfers = tx.tokenTransfers || []
      const nativeTransfers = tx.nativeTransfers || []

      const tokenTx = tokenTransfers.find(t => t.mint === mint)
      const tokenAmount = tokenTx ? Math.abs(tokenTx.tokenAmount) : 0
      const solAmount = Math.abs(nativeTransfers.reduce((sum, t) => sum + (t.amount || 0), 0)) / 1e9

      if (tokenAmount > 0 && solAmount > 0) {
        // Price per token in SOL, convert to rough USD (estimate SOL at ~$150)
        const pricePerToken = solAmount / tokenAmount
        // Use currentPrice to calibrate USD value if available
        trades.push({ ts: Math.floor(ts / 1000), price: pricePerToken, volume: solAmount })
      }
    }

    if (trades.length < 2) return null

    // If we have a current USD price, scale all SOL-denominated prices to USD
    // by using the ratio of latest trade price to current USD price
    const latestTrade = trades.sort((a, b) => b.ts - a.ts)[0]
    const solToUsd = currentPrice && latestTrade.price > 0
      ? currentPrice / latestTrade.price
      : 150 // fallback SOL price estimate

    // Build OHLC candles
    const bucketSizeSec = bucketSize / 1000
    const buckets = {}
    for (const t of trades) {
      const bucketTime = Math.floor(t.ts / bucketSizeSec) * bucketSizeSec
      const price = t.price * solToUsd
      const vol = t.volume * (currentPrice ? solToUsd : 150)
      if (!buckets[bucketTime]) {
        buckets[bucketTime] = { time: bucketTime, open: price, high: price, low: price, close: price, volume: vol }
      } else {
        const b = buckets[bucketTime]
        if (price > b.high) b.high = price
        if (price < b.low) b.low = price
        b.close = price
        b.volume += vol
      }
    }

    const candles = Object.values(buckets).sort((a, b) => a.time - b.time)
    if (candles.length === 0) return null

    // Interpolate flat candles
    for (let i = 0; i < candles.length; i++) {
      const c = candles[i]
      if (c.open === c.high && c.high === c.low && c.low === c.close) {
        if (i > 0) c.open = candles[i - 1].close
        const spread = Math.abs(c.close - c.open)
        const wick = spread > 0 ? spread * 0.3 : c.close * 0.001
        c.high = Math.max(c.open, c.close) + wick
        c.low = Math.min(c.open, c.close) - wick
      }
    }

    return candles
  } catch (e) {
    console.error('fetchCandlesFromTrades error:', e.message)
    return null
  }
}

// GET /api/token/:mint/history
app.get('/api/token/:mint/history', async (req, res) => {
  const { range = '24h' } = req.query
  const intervals = { '1h': '1 hour', '6h': '6 hours', '24h': '24 hours', '7d': '7 days' }
  const interval = intervals[range] || '24 hours'

  try {
    const data = await sql.query(
      `SELECT price, market_cap, volume, timestamp FROM price_history WHERE mint = $1 AND timestamp > NOW() - INTERVAL '${interval}' ORDER BY timestamp ASC`,
      [req.params.mint]
    )

    let candles = []

    if (data.length >= 2) {
      // Build candles from DB data
      let priceChange = 0
      const first = parseFloat(data[0].price)
      const last = parseFloat(data[data.length - 1].price)
      if (first > 0) priceChange = ((last - first) / first) * 100

      const candleMinutes = { '1h': 1, '6h': 5, '24h': 15, '7d': 60 }
      const bucketSize = (candleMinutes[range] || 15) * 60
      const buckets = {}
      for (const r of data) {
        const ts = Math.floor(new Date(r.timestamp).getTime() / 1000)
        const bucketTime = Math.floor(ts / bucketSize) * bucketSize
        const price = parseFloat(r.price)
        const vol = parseFloat(r.volume) || 0
        if (!buckets[bucketTime]) {
          buckets[bucketTime] = { time: bucketTime, open: price, high: price, low: price, close: price, volume: vol }
        } else {
          const b = buckets[bucketTime]
          if (price > b.high) b.high = price
          if (price < b.low) b.low = price
          b.close = price
          b.volume += vol
        }
      }
      candles = Object.values(buckets).sort((a, b) => a.time - b.time)

      // Interpolate flat candles
      for (let i = 0; i < candles.length; i++) {
        const c = candles[i]
        if (c.open === c.high && c.high === c.low && c.low === c.close) {
          if (i > 0) c.open = candles[i - 1].close
          const spread = Math.abs(c.close - c.open)
          const wick = spread > 0 ? spread * 0.3 : c.close * 0.001
          c.high = Math.max(c.open, c.close) + wick
          c.low = Math.min(c.open, c.close) - wick
        }
      }

      return res.json({
        mint: req.params.mint, range,
        priceChange: Math.round(priceChange * 100) / 100,
        dataPoints: candles.length,
        history: candles,
      })
    }

    // No DB data — build candles from Helius trade history
    const pfCandles = await fetchCandlesFromTrades(req.params.mint, range)
    if (pfCandles && pfCandles.length > 0) {
      let priceChange = 0
      const first = pfCandles[0].open
      const last = pfCandles[pfCandles.length - 1].close
      if (first > 0) priceChange = ((last - first) / first) * 100

      return res.json({
        mint: req.params.mint, range,
        priceChange: Math.round(priceChange * 100) / 100,
        dataPoints: pfCandles.length,
        history: pfCandles,
      })
    }

    // No data at all
    res.json({
      mint: req.params.mint, range,
      priceChange: 0,
      dataPoints: 0,
      history: [],
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/tokens/live — fetch trending tokens live from PumpFun
app.get('/api/tokens/live', async (req, res) => {
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

    res.json({ tokens: filtered, total: filtered.length, live: true })
  } catch (e) {
    console.error('Live tokens error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// GET /api/token/:mint/holders
app.get('/api/token/:mint/holders', async (req, res) => {
  const mint = req.params.mint
  const limit = Math.min(parseInt(req.query.limit) || 50, 200)

  try {
    // Fetch token accounts from Helius
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
  } catch (e) {
    console.error('Holders error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

// GET /api/token/:mint/transactions
app.get('/api/token/:mint/transactions', async (req, res) => {
  const keys = [process.env.HELIUS_KEY, process.env.HELIUS_KEY_FALLBACK].filter(Boolean)
  if (!keys.length) {
    return res.status(500).json({ error: 'HELIUS_KEY not configured' })
  }

  try {
    const mint = req.params.mint
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

      const tokenTx = tokenTransfers.find(t => t.mint === mint)
      const tokenAmount = tokenTx ? tokenTx.tokenAmount : 0

      const solTransfer = nativeTransfers.reduce((sum, t) => sum + (t.amount || 0), 0)
      const solAmount = Math.abs(solTransfer) / 1e9

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

    res.json({ mint, transactions })
  } catch (e) {
    console.error('Transactions error:', e.message)
    res.status(500).json({ error: e.message })
  }
})

const PORT = 3001
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})

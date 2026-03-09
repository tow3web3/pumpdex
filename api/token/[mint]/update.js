import { getDb } from '../../_db.js'
import nacl from 'tweetnacl'
import bs58 from 'bs58'

function verifySignature(walletAddress, message, signature) {
  try {
    const pubKeyBytes = bs58.decode(walletAddress)
    const msgBytes = new TextEncoder().encode(message)
    const sigBytes = bs58.decode(signature)
    return nacl.sign.detached.verify(msgBytes, sigBytes, pubKeyBytes)
  } catch {
    return false
  }
}

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
  if (isPumpToken) {
    try {
      const pfRes = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`)
      if (pfRes.ok) {
        const pf = await pfRes.json()
        if (pf && pf.name) {
          const totalSupply = (pf.total_supply || 1e15) / 1e6
          const usdMcap = pf.usd_market_cap || 0
          const priceUsd = usdMcap > 0 ? usdMcap / totalSupply : 0
          return {
            mint, name: pf.name, symbol: pf.symbol || '???',
            description: pf.description || null,
            image_uri: pf.image_uri || null, metadata_uri: pf.metadata_uri || null,
            twitter: pf.twitter && pf.twitter !== 'undefined' ? pf.twitter : null,
            telegram: pf.telegram && pf.telegram !== 'undefined' ? pf.telegram : null,
            website: pf.website && pf.website !== 'undefined' ? pf.website : null,
            price: priceUsd, supply: totalSupply, market_cap: usdMcap,
            volume_24h: 0, liquidity: 0, holder_count: 0,
            is_migrated: pf.complete === true,
            created_at: pf.created_timestamp ? new Date(pf.created_timestamp).toISOString() : null,
          }
        }
      }
    } catch {}
  }

  const asset = await heliusRpc('getAsset', { id: mint })
  if (!asset) return null
  const meta = asset.content?.metadata || {}
  const ti = asset.token_info || {}
  const pi = ti.price_info || {}
  const decimals = ti.decimals || 6
  const supply = (ti.supply || 0) / Math.pow(10, decimals)
  return {
    mint: asset.id || mint, name: meta.name || 'Unknown', symbol: meta.symbol || '???',
    description: meta.description || null,
    image_uri: asset.content?.links?.image || asset.content?.files?.[0]?.uri || null,
    metadata_uri: asset.content?.json_uri || null,
    twitter: null, telegram: null, website: null,
    price: pi.price_per_token || 0, supply, market_cap: (pi.price_per_token || 0) * supply,
    volume_24h: 0, liquidity: 0, holder_count: 0,
    is_migrated: true, created_at: asset.created_at || null,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' })
  }

  const { mint } = req.query
  const sql = getDb()

  try {
    const { description, twitter, telegram, website, walletAddress, signature } = req.body || {}

    // Require wallet signature
    if (!walletAddress || !signature) {
      return res.status(401).json({ error: 'Wallet signature required. Please connect the token creator wallet.' })
    }

    const message = `Update token info for ${mint} on PumpDex`
    if (!verifySignature(walletAddress, message, signature)) {
      return res.status(401).json({ error: 'Invalid signature. Please try again.' })
    }

    const creator = await getTokenCreator(mint)
    if (!creator) {
      return res.status(404).json({ error: 'Could not verify token creator. Is this a PumpFun token?' })
    }
    if (creator !== walletAddress) {
      return res.status(403).json({ error: 'Only the token creator can update token info. Connected wallet does not match.' })
    }

    const clean = {
      description: (description || '').slice(0, 500).trim() || null,
      twitter: (twitter || '').replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 50) || null,
      telegram: (telegram || '').replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 50) || null,
      website: (website || '').slice(0, 200).trim() || null,
    }

    if (clean.website && !/^https?:\/\/.+/.test(clean.website)) {
      clean.website = 'https://' + clean.website
    }

    const existing = await sql`SELECT mint FROM tokens WHERE mint = ${mint}`

    if (existing.length > 0) {
      await sql`UPDATE tokens SET
        description = ${clean.description},
        twitter = ${clean.twitter},
        telegram = ${clean.telegram},
        website = ${clean.website},
        updated_at = NOW()
        WHERE mint = ${mint}`
    } else {
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

    return res.status(200).json({
      description: clean.description,
      twitter: clean.twitter,
      telegram: clean.telegram,
      website: clean.website,
    })
  } catch (error) {
    console.error('Token update error:', error)
    return res.status(500).json({ error: error.message })
  }
}

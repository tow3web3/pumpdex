import { neon } from '@neondatabase/serverless'

export function getDb() {
  return neon(process.env.DATABASE_URL)
}

export async function getPriceChanges(sql, mints) {
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

    // Group by mint
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
        // Find the point closest to target time
        let closest = null
        let minDiff = Infinity
        for (const p of points) {
          const diff = Math.abs(p.ts - targetTime)
          if (diff < minDiff) {
            minDiff = diff
            closest = p
          }
        }
        // Only use if within 2x the interval or 30 min, whichever is larger
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

export function enrichWithChanges(token, histPrices) {
  const currentPrice = parseFloat(token.price) || 0
  const hp = histPrices[token.mint] || {}
  const pctChange = (old) => old && old > 0 ? Math.round(((currentPrice - old) / old) * 10000) / 100 : 0
  return {
    ...token,
    change_5m: pctChange(hp.change_5m),
    change_1h: pctChange(hp.change_1h),
    change_6h: pctChange(hp.change_6h),
    change_24h: pctChange(hp.change_24h),
  }
}

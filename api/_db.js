import { neon } from '@neondatabase/serverless'

export function getDb() {
  return neon(process.env.DATABASE_URL)
}

export async function getPriceChanges(sql, mints) {
  if (!mints.length) return {}
  const placeholders = mints.map((_, i) => `$${i + 1}`).join(',')
  const intervals = [
    { key: 'change_5m', interval: '5 minutes' },
    { key: 'change_1h', interval: '1 hour' },
    { key: 'change_6h', interval: '6 hours' },
    { key: 'change_24h', interval: '24 hours' },
  ]
  const result = {}
  for (const mint of mints) result[mint] = {}

  for (const { key, interval } of intervals) {
    try {
      const rows = await sql.query(
        `SELECT DISTINCT ON (mint) mint, price FROM price_history
         WHERE mint IN (${placeholders}) AND timestamp <= NOW() - INTERVAL '${interval}'
         ORDER BY mint, timestamp DESC`,
        mints
      )
      for (const row of rows) {
        result[row.mint][key] = parseFloat(row.price)
      }
    } catch {}
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

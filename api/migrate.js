import { getDb } from './_db.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' })
  }

  const sql = getDb()

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS tokens (
        mint TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        description TEXT,
        image_uri TEXT,
        metadata_uri TEXT,
        twitter TEXT,
        telegram TEXT,
        website TEXT,
        market_cap NUMERIC DEFAULT 0,
        price NUMERIC DEFAULT 0,
        price_change_24h NUMERIC DEFAULT 0,
        volume_24h NUMERIC DEFAULT 0,
        liquidity NUMERIC DEFAULT 0,
        supply NUMERIC DEFAULT 0,
        holder_count INTEGER DEFAULT 0,
        is_migrated BOOLEAN DEFAULT false,
        raydium_pool TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        synced_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_tokens_market_cap ON tokens (market_cap DESC)
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_tokens_created_at ON tokens (created_at DESC)
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_tokens_is_migrated ON tokens (is_migrated)
    `

    await sql`
      CREATE TABLE IF NOT EXISTS price_history (
        id SERIAL PRIMARY KEY,
        mint TEXT NOT NULL REFERENCES tokens(mint) ON DELETE CASCADE,
        price NUMERIC NOT NULL DEFAULT 0,
        market_cap NUMERIC NOT NULL DEFAULT 0,
        volume NUMERIC NOT NULL DEFAULT 0,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_price_history_mint_ts ON price_history (mint, timestamp DESC)
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_price_history_ts ON price_history (timestamp DESC)
    `

    return res.status(200).json({ success: true, message: 'Migration complete (tokens + price_history)' })
  } catch (error) {
    console.error('Migration error:', error)
    return res.status(500).json({ error: error.message })
  }
}

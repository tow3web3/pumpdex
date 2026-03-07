import { useState, useEffect, useCallback } from 'react'
import { useInView } from '../hooks/useInView'
import TokenDetail from './TokenDetail'
import './TokenScanner.css'

const API_BASE = '/api'

function formatPrice(price) {
  const n = parseFloat(price)
  if (!n || n === 0) return '$0.00'
  if (n < 0.000001) return `$${n.toExponential(2)}`
  if (n < 0.01) return `$${n.toFixed(6)}`
  if (n < 1) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

function formatMarketCap(mc) {
  const n = parseFloat(mc)
  if (!n || n === 0) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function formatVolume(vol) {
  const n = parseFloat(vol)
  if (!n || n === 0) return '-'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function timeAgo(dateStr) {
  if (!dateStr) return '-'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function getInitials(name) {
  return (name || '??').slice(0, 2).toUpperCase()
}

function getColor(name) {
  const colors = ['#00ff88', '#4488ff', '#aa66ff', '#ffcc00', '#ff4466', '#00ddff', '#ff8844', '#88ff44']
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

export default function TokenScanner() {
  const [ref, inView] = useInView()
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('market_cap')
  const [total, setTotal] = useState(0)

  const fetchTokens = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({
        sort,
        order: 'desc',
        limit: '50',
        offset: '0',
        ...(search && { search }),
        ...(filter !== 'all' && { status: filter === 'migrating' ? 'not_migrated' : 'migrated' }),
      })
      const res = await fetch(`${API_BASE}/tokens?${params}`)
      if (!res.ok) throw new Error('Failed to fetch tokens')
      const data = await res.json()
      setTokens(data.tokens || [])
      setTotal(data.total || 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [search, filter, sort])

  useEffect(() => {
    const debounce = setTimeout(fetchTokens, 300)
    return () => clearTimeout(debounce)
  }, [fetchTokens])

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchTokens, 30000)
    return () => clearInterval(interval)
  }, [fetchTokens])

  const handleSort = (col) => {
    setSort(col)
  }

  return (
    <section id="scanner" className="scanner" ref={ref}>
      <div className="scanner__inner">
        <div className={`scanner__header ${inView ? 'scanner__header--visible' : ''}`}>
          <span className="section-label">Token Scanner</span>
          <h2 className="section-title">Scan PumpFun Coins<br /><span className="text-accent">In Real Time</span></h2>
          <p className="section-sub">Every PumpFun coin, tracked and displayed. No fees, no delays.</p>
        </div>

        <div className={`scanner__controls ${inView ? 'scanner__controls--visible' : ''}`}>
          <div className="scanner__search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Search token name or symbol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="scanner__search-input"
            />
          </div>
          <div className="scanner__filters">
            {['all', 'migrating', 'migrated'].map(f => (
              <button
                key={f}
                className={`scanner__filter ${filter === f ? 'scanner__filter--active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? `All (${total})` : f === 'migrating' ? 'Migrating' : 'Migrated'}
              </button>
            ))}
          </div>
        </div>

        <div className={`scanner__table-wrap ${inView ? 'scanner__table-wrap--visible' : ''}`}>
          <div className="scanner__table">
            <div className="scanner__row scanner__row--header">
              <span className="scanner__col scanner__col--token">Token</span>
              <span className="scanner__col scanner__col--sortable" onClick={() => handleSort('price')}>
                Price {sort === 'price' && '↓'}
              </span>
              <span className="scanner__col scanner__col--sortable" onClick={() => handleSort('market_cap')}>
                Market Cap {sort === 'market_cap' && '↓'}
              </span>
              <span className="scanner__col scanner__col--sortable" onClick={() => handleSort('volume_24h')}>
                Volume {sort === 'volume_24h' && '↓'}
              </span>
              <span className="scanner__col">Age</span>
              <span className="scanner__col">Status</span>
            </div>

            {loading && tokens.length === 0 && (
              <div className="scanner__loading">
                <div className="scanner__spinner" />
                Loading tokens...
              </div>
            )}

            {error && (
              <div className="scanner__error">
                {error}
                <button className="scanner__retry" onClick={fetchTokens}>Retry</button>
              </div>
            )}

            {!loading && !error && tokens.length === 0 && (
              <div className="scanner__empty">
                No tokens found. Try syncing data first.
              </div>
            )}

            {tokens.map((token, i) => {
              const status = token.is_migrated ? 'migrated' : 'migrating'
              return (
                <div key={token.mint} className="scanner__row" style={{ animationDelay: `${i * 0.03}s` }}>
                  <span className="scanner__col scanner__col--token">
                    {token.image_uri ? (
                      <img src={token.image_uri} alt="" className="scanner__avatar-img" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
                    ) : null}
                    <div
                      className="scanner__avatar"
                      style={{
                        background: `${getColor(token.name)}22`,
                        color: getColor(token.name),
                        display: token.image_uri ? 'none' : 'flex',
                      }}
                    >
                      {getInitials(token.name)}
                    </div>
                    <div>
                      <span className="scanner__token-name">{token.name}</span>
                      <span className="scanner__token-symbol">${token.symbol}</span>
                    </div>
                  </span>
                  <span className="scanner__col scanner__col--mono">{formatPrice(token.price)}</span>
                  <span className="scanner__col scanner__col--mono">{formatMarketCap(token.market_cap)}</span>
                  <span className="scanner__col scanner__col--mono">{formatVolume(token.volume_24h)}</span>
                  <span className="scanner__col scanner__col--muted">{timeAgo(token.created_at)}</span>
                  <span className="scanner__col">
                    <span className={`scanner__status scanner__status--${status}`}>
                      {status === 'migrating' && <span className="scanner__status-dot" />}
                      {status}
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

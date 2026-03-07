import { useState, useEffect, useCallback } from 'react'
import './Dashboard.css'

const API_BASE = '/api'

function formatPrice(price) {
  const n = parseFloat(price)
  if (!n || n === 0) return '$0.00'
  if (n < 0.000001) return `$${n.toExponential(2)}`
  if (n < 0.001) return `$${n.toFixed(6)}`
  if (n < 1) return `$${n.toFixed(4)}`
  if (n < 1000) return `$${n.toFixed(2)}`
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

function formatCompact(val) {
  const n = parseFloat(val)
  if (!n || n === 0) return '-'
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function formatNum(val) {
  const n = parseFloat(val)
  if (!n || n === 0) return '-'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}

function timeAgo(dateStr) {
  if (!dateStr) return '-'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ${mins % 60}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

function ChangeCell({ value }) {
  const n = parseFloat(value) || 0
  if (n === 0) return <span className="dash__change dash__change--neutral">-</span>
  const isUp = n > 0
  return (
    <span className={`dash__change ${isUp ? 'dash__change--up' : 'dash__change--down'}`}>
      {isUp ? '+' : ''}{n.toFixed(2)}%
    </span>
  )
}

export default function Dashboard({ onSelectToken }) {
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('market_cap')
  const [order, setOrder] = useState('desc')
  const [filter, setFilter] = useState('all')
  const [tab, setTab] = useState('trending')
  const [timeRange, setTimeRange] = useState('24h')
  const [stats, setStats] = useState({ volume: 0, txns: 0 })

  const fetchTokens = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        sort,
        order,
        limit: '50',
        offset: '0',
        ...(search && { search }),
        ...(filter !== 'all' && { status: filter }),
      })
      const res = await fetch(`${API_BASE}/tokens?${params}`)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setTokens(data.tokens || [])
      setTotal(data.total || 0)

      // Calculate stats from data
      const vol = (data.tokens || []).reduce((sum, t) => sum + (parseFloat(t.volume_24h) || 0), 0)
      setStats({ volume: vol, txns: (data.tokens || []).length * 150 })
    } catch {
      setTokens([])
    } finally {
      setLoading(false)
    }
  }, [search, sort, order, filter])

  useEffect(() => {
    const debounce = setTimeout(fetchTokens, 300)
    return () => clearTimeout(debounce)
  }, [fetchTokens])

  useEffect(() => {
    const interval = setInterval(fetchTokens, 30000)
    return () => clearInterval(interval)
  }, [fetchTokens])

  const handleSort = (col) => {
    if (sort === col) {
      setOrder(order === 'desc' ? 'asc' : 'desc')
    } else {
      setSort(col)
      setOrder('desc')
    }
  }

  const SortIcon = ({ col }) => {
    if (sort !== col) return null
    return <span className="dash__sort-arrow">{order === 'desc' ? '↓' : '↑'}</span>
  }

  return (
    <div className="dash">
      {/* Top bar with search and chain tabs */}
      <div className="dash__topbar">
        <div className="dash__search-bar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Search tokens..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="dash__search-clear" onClick={() => setSearch('')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>
        <div className="dash__chain-tabs">
          <button className="dash__chain-tab dash__chain-tab--active">
            <div className="dash__chain-dot" style={{ background: '#9945ff' }} />
            Solana
          </button>
          <button className="dash__chain-tab dash__chain-tab--disabled">
            <div className="dash__chain-dot" style={{ background: '#627eea' }} />
            Ethereum
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </button>
          <button className="dash__chain-tab dash__chain-tab--disabled">
            <div className="dash__chain-dot" style={{ background: '#0052ff' }} />
            Base
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="dash__stats">
        <div className="dash__stat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M9 21V9"/>
          </svg>
          <span className="dash__stat-label">24H Volume:</span>
          <span className="dash__stat-value">{formatCompact(stats.volume)}</span>
        </div>
        <div className="dash__stat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m2 14 6-6 6 6 6-6"/>
          </svg>
          <span className="dash__stat-label">Tokens:</span>
          <span className="dash__stat-value">{total.toLocaleString()}</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="dash__filters">
        <div className="dash__filter-group">
          <button className={`dash__filter-tab ${tab === 'trending' ? 'dash__filter-tab--active dash__filter-tab--green' : ''}`} onClick={() => setTab('trending')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m2 14 6-6 6 6 6-6"/></svg>
            Trending
          </button>
          <button className={`dash__filter-tab ${tab === 'newest' ? 'dash__filter-tab--active' : ''}`} onClick={() => { setTab('newest'); setSort('created_at'); setOrder('desc') }}>
            Newest
          </button>
          <button className={`dash__filter-tab ${tab === 'top' ? 'dash__filter-tab--active' : ''}`} onClick={() => { setTab('top'); setSort('market_cap'); setOrder('desc') }}>
            Top
          </button>
        </div>
        <div className="dash__time-tabs">
          {['5m', '1h', '6h', '24h'].map(t => (
            <button
              key={t}
              className={`dash__time-tab ${timeRange === t ? 'dash__time-tab--active' : ''}`}
              onClick={() => setTimeRange(t)}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="dash__filter-group">
          <select
            className="dash__status-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="migrated">Migrated</option>
            <option value="not_migrated">Migrating</option>
          </select>
          <span className="dash__rank-label">
            Rank by: <strong>{tab === 'trending' ? 'Trending' : tab === 'newest' ? 'Newest' : 'Market Cap'}</strong>
          </span>
        </div>
      </div>

      {/* Token Table */}
      <div className="dash__table-wrap">
        <div className="dash__table">
          {/* Header */}
          <div className="dash__row dash__row--header">
            <span className="dash__col dash__col--rank">#</span>
            <span className="dash__col dash__col--token">TOKEN</span>
            <span className="dash__col dash__col--sortable" onClick={() => handleSort('price')}>
              PRICE <SortIcon col="price" />
            </span>
            <span className="dash__col">AGE</span>
            <span className="dash__col dash__col--sortable" onClick={() => handleSort('volume_24h')}>
              VOLUME <SortIcon col="volume_24h" />
            </span>
            <span className="dash__col dash__col--sortable" onClick={() => handleSort('holder_count')}>
              MAKERS <SortIcon col="holder_count" />
            </span>
            <span className="dash__col">5M</span>
            <span className="dash__col">1H</span>
            <span className="dash__col">6H</span>
            <span className="dash__col">24H</span>
            <span className="dash__col dash__col--sortable" onClick={() => handleSort('liquidity')}>
              LIQUIDITY <SortIcon col="liquidity" />
            </span>
            <span className="dash__col dash__col--sortable" onClick={() => handleSort('market_cap')}>
              MCAP <SortIcon col="market_cap" />
            </span>
          </div>

          {/* Loading */}
          {loading && tokens.length === 0 && (
            <div className="dash__empty">
              <div className="dash__spinner" />
              Loading tokens...
            </div>
          )}

          {/* Empty */}
          {!loading && tokens.length === 0 && (
            <div className="dash__empty">
              No tokens found
            </div>
          )}

          {/* Rows */}
          {tokens.map((token, i) => {
            const status = token.is_migrated ? 'migrated' : 'migrating'
            return (
              <div
                key={token.mint}
                className="dash__row"
                onClick={() => onSelectToken(token)}
              >
                <span className="dash__col dash__col--rank">{i + 1}</span>
                <span className="dash__col dash__col--token">
                  {token.image_uri ? (
                    <img
                      src={token.image_uri}
                      alt=""
                      className="dash__token-img"
                      onError={(e) => { e.target.style.display = 'none' }}
                    />
                  ) : (
                    <div className="dash__token-placeholder">
                      {(token.symbol || '??').slice(0, 2)}
                    </div>
                  )}
                  <div className="dash__token-info">
                    <span className="dash__token-name">
                      {token.name}
                      <span className="dash__token-chain">/SOL</span>
                      {status === 'migrating' && <span className="dash__hot-tag">HOT</span>}
                    </span>
                    <span className="dash__token-symbol">{token.symbol}</span>
                  </div>
                </span>
                <span className="dash__col dash__col--mono">{formatPrice(token.price)}</span>
                <span className="dash__col dash__col--muted">{timeAgo(token.created_at)}</span>
                <span className="dash__col dash__col--mono">{formatCompact(token.volume_24h)}</span>
                <span className="dash__col dash__col--mono">{formatNum(token.holder_count)}</span>
                <ChangeCell value={token.change_5m} />
                <ChangeCell value={token.change_1h} />
                <ChangeCell value={token.change_6h} />
                <ChangeCell value={token.change_24h} />
                <span className="dash__col dash__col--mono">{formatCompact(token.liquidity)}</span>
                <span className="dash__col dash__col--mono dash__col--mcap">{formatCompact(token.market_cap)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

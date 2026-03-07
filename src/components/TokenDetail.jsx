import { useState, useEffect } from 'react'
import PriceChart from './PriceChart'
import './TokenDetail.css'

const API_BASE = '/api'

function formatPrice(price) {
  const n = parseFloat(price)
  if (!n || n === 0) return '$0.00'
  if (n < 0.000001) return `$${n.toExponential(2)}`
  if (n < 0.01) return `$${n.toFixed(6)}`
  if (n < 1) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

function formatMc(mc) {
  const n = parseFloat(mc)
  if (!n) return '$0'
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toFixed(0)}`
}

function formatNum(val) {
  const n = parseFloat(val)
  if (!n || n === 0) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function timeAgo(dateStr) {
  if (!dateStr) return '-'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function ChangeTag({ value, label }) {
  const n = parseFloat(value) || 0
  const isUp = n > 0
  const isZero = n === 0
  return (
    <div className="td__change-item">
      <span className="td__change-label">{label}</span>
      <span className={`td__change-val ${isZero ? '' : isUp ? 'td__change-val--up' : 'td__change-val--down'}`}>
        {isZero ? '-' : `${isUp ? '+' : ''}${n.toFixed(2)}%`}
      </span>
    </div>
  )
}

export default function TokenDetail({ token, onBack }) {
  const [chartData, setChartData] = useState([])
  const [chartLoading, setChartLoading] = useState(true)
  const [range, setRange] = useState('24h')
  const [priceChange, setPriceChange] = useState(0)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState('txns')
  const [freshToken, setFreshToken] = useState(token)

  // Fetch fresh token data
  useEffect(() => {
    if (!token) return
    async function fetchToken() {
      try {
        const res = await fetch(`${API_BASE}/token/${token.mint}`)
        if (res.ok) {
          const data = await res.json()
          setFreshToken(data)
        }
      } catch {}
    }
    fetchToken()
  }, [token])

  useEffect(() => {
    if (!token) return
    async function fetchHistory() {
      setChartLoading(true)
      try {
        const res = await fetch(`${API_BASE}/token/${token.mint}/history?range=${range}`)
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        setPriceChange(data.priceChange || 0)
        setChartData(
          (data.history || []).map(p => ({
            time: p.time,
            value: p.price,
            volume: p.volume || 0,
          }))
        )
      } catch {
        setChartData([])
      } finally {
        setChartLoading(false)
      }
    }
    fetchHistory()
  }, [token, range])

  if (!token) return null

  const t = freshToken || token
  const solPrice = 150
  const priceInSol = t.price ? (parseFloat(t.price) / solPrice) : 0

  const handleCopy = () => {
    navigator.clipboard.writeText(t.mint)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="td">
      {/* Top bar */}
      <div className="td__topbar">
        <button className="td__back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
          Back
        </button>
        <div className="td__topbar-token">
          {t.image_uri ? (
            <img src={t.image_uri} alt="" className="td__topbar-img" />
          ) : (
            <div className="td__topbar-placeholder">{(t.symbol || '??').slice(0, 2)}</div>
          )}
          <span className="td__topbar-name">{t.name}</span>
          <span className="td__topbar-symbol">{t.symbol}/SOL</span>
        </div>
        <div className="td__topbar-actions">
          <button className="td__topbar-btn" onClick={handleCopy}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            {copied ? 'Copied!' : 'Copy CA'}
          </button>
        </div>
      </div>

      {/* Main content: chart left, stats right */}
      <div className="td__content">
        {/* Left: Chart area */}
        <div className="td__chart-area">
          <div className="td__chart-controls">
            <div className="td__ranges">
              {['1h', '6h', '24h', '7d'].map(r => (
                <button
                  key={r}
                  className={`td__range ${range === r ? 'td__range--active' : ''}`}
                  onClick={() => setRange(r)}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <PriceChart data={chartData} loading={chartLoading} height={460} />

          {/* Tabs below chart */}
          <div className="td__bottom-tabs">
            <button className={`td__btab ${activeTab === 'txns' ? 'td__btab--active' : ''}`} onClick={() => setActiveTab('txns')}>
              Transactions
            </button>
            <button className={`td__btab ${activeTab === 'holders' ? 'td__btab--active' : ''}`} onClick={() => setActiveTab('holders')}>
              Holders
            </button>
            <button className={`td__btab ${activeTab === 'info' ? 'td__btab--active' : ''}`} onClick={() => setActiveTab('info')}>
              Info
            </button>
          </div>

          <div className="td__bottom-content">
            {activeTab === 'txns' && (
              <div className="td__txn-placeholder">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                <span>Transaction history coming soon</span>
              </div>
            )}
            {activeTab === 'holders' && (
              <div className="td__txn-placeholder">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span>{formatNum(t.holder_count)} holders</span>
              </div>
            )}
            {activeTab === 'info' && (
              <div className="td__info-panel">
                {t.description && <p className="td__description">{t.description}</p>}
                <div className="td__info-row">
                  <span>Mint Address</span>
                  <code>{t.mint}</code>
                </div>
                <div className="td__info-row">
                  <span>Created</span>
                  <span>{timeAgo(t.created_at)}</span>
                </div>
                <div className="td__info-row">
                  <span>Supply</span>
                  <span>{formatNum(t.supply)}</span>
                </div>
                {(t.twitter || t.telegram || t.website) && (
                  <div className="td__info-socials">
                    {t.website && (
                      <a href={t.website} target="_blank" rel="noopener noreferrer" className="td__social-link">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                        Website
                      </a>
                    )}
                    {t.twitter && (
                      <a href={`https://x.com/${t.twitter}`} target="_blank" rel="noopener noreferrer" className="td__social-link">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                        Twitter
                      </a>
                    )}
                    {t.telegram && (
                      <a href={`https://t.me/${t.telegram}`} target="_blank" rel="noopener noreferrer" className="td__social-link">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                        Telegram
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Stats sidebar */}
        <div className="td__sidebar">
          {/* Token identity */}
          <div className="td__token-header">
            {t.image_uri ? (
              <img src={t.image_uri} alt="" className="td__token-img" />
            ) : (
              <div className="td__token-placeholder">
                {(t.name || '??').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="td__token-names">
              <h2 className="td__token-name">{t.name}</h2>
              <span className="td__token-symbol">${t.symbol}</span>
            </div>
          </div>

          {/* Price */}
          <div className="td__price-section">
            <span className="td__price">{formatPrice(t.price)}</span>
            <span className="td__price-sol">{priceInSol > 0 ? `${priceInSol.toFixed(8)} SOL` : '-'}</span>
            <span className={`td__price-change ${priceChange >= 0 ? 'td__price-change--up' : 'td__price-change--down'}`}>
              {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
            </span>
          </div>

          {/* Key stats */}
          <div className="td__stats-grid">
            <div className="td__stat-box">
              <span className="td__stat-label">LIQUIDITY</span>
              <span className="td__stat-value">{formatMc(t.liquidity)}</span>
            </div>
            <div className="td__stat-box">
              <span className="td__stat-label">FDV</span>
              <span className="td__stat-value">{formatMc(t.market_cap)}</span>
            </div>
            <div className="td__stat-box">
              <span className="td__stat-label">MKT CAP</span>
              <span className="td__stat-value">{formatMc(t.market_cap)}</span>
            </div>
          </div>

          {/* Price changes */}
          <div className="td__changes">
            <ChangeTag label="5M" value={t.price_change_24h} />
            <ChangeTag label="1H" value={t.price_change_24h} />
            <ChangeTag label="6H" value={t.price_change_24h} />
            <ChangeTag label="24H" value={t.price_change_24h} />
          </div>

          {/* Transaction stats */}
          <div className="td__txn-stats">
            <div className="td__txn-row">
              <span className="td__txn-label">TXNS</span>
              <span className="td__txn-value">{formatNum(t.txns_24h || 0)}</span>
            </div>
            <div className="td__txn-row">
              <span className="td__txn-label">VOLUME</span>
              <span className="td__txn-value">{formatMc(t.volume_24h)}</span>
            </div>
            <div className="td__txn-row">
              <span className="td__txn-label">HOLDERS</span>
              <span className="td__txn-value">{formatNum(t.holder_count)}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="td__actions">
            <a
              href={`https://pump.fun/coin/${t.mint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="td__buy-btn"
            >
              Buy on PumpFun
            </a>
            <a
              href={`https://pump.fun/coin/${t.mint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="td__view-link"
            >
              View on PumpFun
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </div>

          {/* Update info */}
          <button className="td__update-btn">
            Update Token Info
            <span className="td__free-tag">FREE</span>
          </button>
        </div>
      </div>
    </div>
  )
}

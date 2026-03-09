import { useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import bs58 from 'bs58'
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

function formatTokenAmt(val) {
  const n = parseFloat(val)
  if (!n) return '0'
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function formatSol(val) {
  const n = parseFloat(val)
  if (!n) return '0'
  if (n >= 1000) return `${(n / 1000).toFixed(2)}K`
  if (n >= 1) return n.toFixed(2)
  return n.toFixed(4)
}

function txnTimeAgo(ts) {
  if (!ts) return '-'
  const diff = Date.now() - ts * 1000
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function shortenAddr(addr) {
  if (!addr || addr.length < 8) return addr || ''
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`
}

export default function TokenDetail({ token, onBack }) {
  const { publicKey, signMessage, connected } = useWallet()
  const [chartInterval, setChartInterval] = useState('15m')
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState('txns')
  const [freshToken, setFreshToken] = useState(token)
  const [transactions, setTransactions] = useState([])
  const [txnLoading, setTxnLoading] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [holders, setHolders] = useState([])
  const [holdersLoading, setHoldersLoading] = useState(false)
  const [updateForm, setUpdateForm] = useState({ description: '', twitter: '', telegram: '', website: '' })
  const [updateSaving, setUpdateSaving] = useState(false)
  const [updateMsg, setUpdateMsg] = useState(null)

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


  // Fetch transactions
  useEffect(() => {
    if (!token) return
    let cancelled = false
    async function fetchTxns() {
      setTxnLoading(true)
      try {
        const res = await fetch(`${API_BASE}/token/${token.mint}/transactions`)
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        if (!cancelled) setTransactions(data.transactions || [])
      } catch {
        if (!cancelled) setTransactions([])
      } finally {
        if (!cancelled) setTxnLoading(false)
      }
    }
    fetchTxns()
    // Auto-refresh every 30s
    const interval = setInterval(fetchTxns, 30000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [token])

  // Fetch holders when tab is activated
  useEffect(() => {
    if (activeTab !== 'holders' || !token) return
    if (holders.length > 0) return // already fetched
    let cancelled = false
    async function fetchHolders() {
      setHoldersLoading(true)
      try {
        const res = await fetch(`${API_BASE}/token/${token.mint}/holders?limit=100`)
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        if (!cancelled) setHolders(data.holders || [])
      } catch {
        if (!cancelled) setHolders([])
      } finally {
        if (!cancelled) setHoldersLoading(false)
      }
    }
    fetchHolders()
    return () => { cancelled = true }
  }, [activeTab, token])

  const openUpdateModal = () => {
    const t = freshToken || token
    setUpdateForm({
      description: t.description || '',
      twitter: t.twitter || '',
      telegram: t.telegram || '',
      website: t.website || '',
    })
    setUpdateMsg(null)
    setShowUpdateModal(true)
  }

  const handleUpdateSubmit = async (e) => {
    e.preventDefault()
    if (!connected || !publicKey || !signMessage) {
      setUpdateMsg({ type: 'error', text: 'Please connect the token creator wallet first.' })
      return
    }
    setUpdateSaving(true)
    setUpdateMsg(null)
    try {
      const message = `Update token info for ${token.mint} on PumpDex`
      const msgBytes = new TextEncoder().encode(message)
      const signatureBytes = await signMessage(msgBytes)
      const signature = bs58.encode(signatureBytes)

      const res = await fetch(`${API_BASE}/token/${token.mint}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updateForm,
          walletAddress: publicKey.toBase58(),
          signature,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Update failed')
      }
      const updated = await res.json()
      setFreshToken(prev => ({ ...prev, ...updated }))
      setUpdateMsg({ type: 'success', text: 'Token info updated successfully!' })
      setTimeout(() => setShowUpdateModal(false), 1500)
    } catch (err) {
      setUpdateMsg({ type: 'error', text: err.message })
    } finally {
      setUpdateSaving(false)
    }
  }

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
              {['1m', '5m', '15m', '1H', '4H', '1D'].map(r => (
                <button
                  key={r}
                  className={`td__range ${chartInterval === r ? 'td__range--active' : ''}`}
                  onClick={() => setChartInterval(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="td__chart-widget">
            <iframe
              key={`${t.mint}-${chartInterval}`}
              src={`https://birdeye.so/tv-widget/${t.mint}?chain=solana&viewMode=pair&chartInterval=${chartInterval}&chartType=CANDLE&chartTimezone=America%2FNew_York&chartLeftToolbar=show&theme=dark`}
              allowFullScreen
              style={{ width: '100%', height: '460px', border: 'none', borderRadius: '8px' }}
            />
          </div>

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
              <div className="td__txn-list">
                {txnLoading && transactions.length === 0 ? (
                  <div className="td__txn-placeholder">
                    <div className="td__txn-spinner" />
                    <span>Loading transactions...</span>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="td__txn-placeholder">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                    <span>No transactions found</span>
                  </div>
                ) : (
                  <>
                    <div className="td__txn-table-head">
                      <span>Type</span>
                      <span>Tokens</span>
                      <span>SOL</span>
                      <span>Wallet</span>
                      <span>Time</span>
                    </div>
                    {transactions.map(tx => (
                      <a
                        key={tx.signature}
                        className={`td__txn-item ${tx.type === 'buy' ? 'td__txn-item--buy' : 'td__txn-item--sell'}`}
                        href={`https://solscan.io/tx/${tx.signature}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span className={`td__txn-type ${tx.type === 'buy' ? 'td__txn-type--buy' : 'td__txn-type--sell'}`}>
                          {tx.type === 'buy' ? 'Buy' : 'Sell'}
                        </span>
                        <span className="td__txn-amt">{formatTokenAmt(tx.tokenAmount)}</span>
                        <span className="td__txn-sol">{formatSol(tx.solAmount)} SOL</span>
                        <span className="td__txn-wallet">{shortenAddr(tx.wallet)}</span>
                        <span className="td__txn-time">{txnTimeAgo(tx.timestamp)}</span>
                      </a>
                    ))}
                  </>
                )}
              </div>
            )}
            {activeTab === 'holders' && (
              <div className="td__holders-list">
                {holdersLoading && holders.length === 0 ? (
                  <div className="td__txn-placeholder">
                    <div className="td__txn-spinner" />
                    <span>Loading holders...</span>
                  </div>
                ) : holders.length === 0 ? (
                  <div className="td__txn-placeholder">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    <span>No holder data available</span>
                  </div>
                ) : (
                  <>
                    <div className="td__holders-head">
                      <span>#</span>
                      <span>Wallet</span>
                      <span>Amount</span>
                      <span>%</span>
                    </div>
                    {holders.map((h, i) => (
                      <a
                        key={h.address}
                        className="td__holder-row"
                        href={`https://solscan.io/account/${h.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <span className="td__holder-rank">{i + 1}</span>
                        <span className="td__holder-addr">{shortenAddr(h.address)}</span>
                        <span className="td__holder-amt">{formatTokenAmt(h.amount)}</span>
                        <span className="td__holder-pct">
                          <span className="td__holder-bar" style={{ width: `${Math.min(h.pct, 100)}%` }} />
                          {h.pct.toFixed(2)}%
                        </span>
                      </a>
                    ))}
                  </>
                )}
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
            <span className={`td__price-change ${parseFloat(t.change_24h) >= 0 ? 'td__price-change--up' : 'td__price-change--down'}`}>
              {parseFloat(t.change_24h) >= 0 ? '+' : ''}{(parseFloat(t.change_24h) || 0).toFixed(2)}%
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
            <ChangeTag label="5M" value={t.change_5m} />
            <ChangeTag label="1H" value={t.change_1h} />
            <ChangeTag label="6H" value={t.change_6h} />
            <ChangeTag label="24H" value={t.change_24h} />
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
          <button className="td__update-btn" onClick={openUpdateModal}>
            Update Token Info
            <span className="td__free-tag">FREE</span>
          </button>
        </div>
      </div>

      {/* Update Modal */}
      {showUpdateModal && (
        <div className="td__modal-overlay" onClick={() => setShowUpdateModal(false)}>
          <div className="td__modal" onClick={e => e.stopPropagation()}>
            <div className="td__modal-header">
              <h3 className="td__modal-title">
                Update Token Info
                <span className="td__free-tag">FREE</span>
              </h3>
              <button className="td__modal-close" onClick={() => setShowUpdateModal(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <p className="td__modal-sub">
              Update your token's info on PumpDex — completely free. Connect the <strong>creator wallet</strong> to verify ownership.
            </p>

            <div className="td__modal-wallet">
              <WalletMultiButton />
              {connected && publicKey && (
                <span className="td__modal-wallet-addr">
                  {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
                </span>
              )}
            </div>

            <form className="td__modal-form" onSubmit={handleUpdateSubmit}>
              <div className="td__modal-field">
                <label className="td__modal-label">Description</label>
                <textarea
                  className="td__modal-textarea"
                  placeholder="Describe your token, project, or community..."
                  value={updateForm.description}
                  onChange={e => setUpdateForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  maxLength={500}
                />
                <span className="td__modal-hint">{updateForm.description.length}/500</span>
              </div>

              <div className="td__modal-field">
                <label className="td__modal-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  Twitter / X
                </label>
                <input
                  className="td__modal-input"
                  type="text"
                  placeholder="username (without @)"
                  value={updateForm.twitter}
                  onChange={e => setUpdateForm(f => ({ ...f, twitter: e.target.value.replace(/^@/, '') }))}
                />
              </div>

              <div className="td__modal-field">
                <label className="td__modal-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                  Telegram
                </label>
                <input
                  className="td__modal-input"
                  type="text"
                  placeholder="group or channel name"
                  value={updateForm.telegram}
                  onChange={e => setUpdateForm(f => ({ ...f, telegram: e.target.value }))}
                />
              </div>

              <div className="td__modal-field">
                <label className="td__modal-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  Website
                </label>
                <input
                  className="td__modal-input"
                  type="url"
                  placeholder="https://yourproject.com"
                  value={updateForm.website}
                  onChange={e => setUpdateForm(f => ({ ...f, website: e.target.value }))}
                />
              </div>

              {updateMsg && (
                <div className={`td__modal-msg td__modal-msg--${updateMsg.type}`}>
                  {updateMsg.type === 'success' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
                  )}
                  {updateMsg.text}
                </div>
              )}

              <button className="td__modal-submit" type="submit" disabled={updateSaving || !connected}>
                {updateSaving ? (
                  <>
                    <div className="td__modal-spinner" />
                    Signing & Saving...
                  </>
                ) : !connected ? (
                  'Connect Wallet to Save'
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
                    Sign & Save Changes
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

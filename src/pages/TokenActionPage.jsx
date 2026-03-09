import { useState, useEffect, useRef } from 'react'
import './TokenActionPage.css'

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

export default function TokenActionPage({ mint, onBack, onLaunchApp }) {
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [visible, setVisible] = useState(false)
  const [bannerPrompt, setBannerPrompt] = useState('')
  const [bannerGenerating, setBannerGenerating] = useState(false)
  const [bannerUrl, setBannerUrl] = useState(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (!mint) return
    setLoading(true)
    setError(null)
    fetch(`${API_BASE}/token/${mint}`)
      .then(res => {
        if (!res.ok) throw new Error('Token not found')
        return res.json()
      })
      .then(data => { setToken(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [mint])

  const handleCopy = () => {
    navigator.clipboard.writeText(mint)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleGenerateBanner = async () => {
    if (!token) return
    setBannerGenerating(true)
    setBannerUrl(null)

    // Generate a professional banner using Canvas API
    await new Promise(r => setTimeout(r, 1500)) // simulate generation time

    const canvas = canvasRef.current
    if (!canvas) { setBannerGenerating(false); return }
    canvas.width = 1500
    canvas.height = 500
    const ctx = canvas.getContext('2d')

    // Background gradient
    const bg = ctx.createLinearGradient(0, 0, 1500, 500)
    bg.addColorStop(0, '#0a0a14')
    bg.addColorStop(0.5, '#0d1a12')
    bg.addColorStop(1, '#0a0a14')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, 1500, 500)

    // Grid pattern
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.04)'
    ctx.lineWidth = 1
    for (let x = 0; x < 1500; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 500); ctx.stroke()
    }
    for (let y = 0; y < 500; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(1500, y); ctx.stroke()
    }

    // Glow orbs
    const drawOrb = (x, y, r, color) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, color)
      g.addColorStop(1, 'transparent')
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
    drawOrb(300, 250, 300, 'rgba(0, 255, 136, 0.08)')
    drawOrb(1200, 150, 250, 'rgba(68, 136, 255, 0.05)')
    drawOrb(900, 400, 200, 'rgba(170, 102, 255, 0.04)')

    // Decorative chart line
    ctx.beginPath()
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.15)'
    ctx.lineWidth = 2
    const points = []
    for (let x = 0; x <= 1500; x += 10) {
      const y = 350 + Math.sin(x * 0.008) * 60 + Math.sin(x * 0.02) * 20 + Math.cos(x * 0.005) * 30
      points.push({ x, y })
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // Chart fill
    ctx.lineTo(1500, 500)
    ctx.lineTo(0, 500)
    ctx.closePath()
    const chartGrad = ctx.createLinearGradient(0, 300, 0, 500)
    chartGrad.addColorStop(0, 'rgba(0, 255, 136, 0.06)')
    chartGrad.addColorStop(1, 'transparent')
    ctx.fillStyle = chartGrad
    ctx.fill()

    // Token image placeholder circle
    ctx.beginPath()
    ctx.arc(200, 180, 60, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0, 255, 136, 0.12)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)'
    ctx.lineWidth = 2
    ctx.stroke()

    // Token symbol in circle
    ctx.font = 'bold 28px Inter, sans-serif'
    ctx.fillStyle = '#00ff88'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText((token.symbol || '??').slice(0, 4), 200, 180)

    // Token name
    ctx.textAlign = 'left'
    ctx.font = 'bold 52px Inter, sans-serif'
    ctx.fillStyle = '#e8e8f0'
    ctx.fillText(token.name || token.symbol || 'Token', 300, 160)

    // Token symbol tag
    ctx.font = '600 24px JetBrains Mono, monospace'
    ctx.fillStyle = '#00ff88'
    ctx.fillText(`$${(token.symbol || '').toUpperCase()}`, 300, 210)

    // Stats row
    const stats = [
      { label: 'PRICE', value: formatPrice(token.price) },
      { label: 'MCAP', value: formatCompact(token.market_cap) },
      { label: 'LIQUIDITY', value: formatCompact(token.liquidity) },
      { label: 'HOLDERS', value: token.holder_count?.toLocaleString() || '-' },
    ]
    let sx = 200
    for (const s of stats) {
      ctx.font = '700 11px Inter, sans-serif'
      ctx.fillStyle = '#555570'
      ctx.fillText(s.label, sx, 290)
      ctx.font = '700 20px JetBrains Mono, monospace'
      ctx.fillStyle = '#e8e8f0'
      ctx.fillText(s.value, sx, 318)
      sx += 280
    }

    // PumpDex branding
    ctx.textAlign = 'right'
    ctx.font = 'bold 20px Inter, sans-serif'
    ctx.fillStyle = '#00ff88'
    ctx.fillText('PumpDex', 1440, 60)
    ctx.font = '500 13px Inter, sans-serif'
    ctx.fillStyle = '#555570'
    ctx.fillText('pumpdex.io', 1440, 84)

    // Custom prompt text
    if (bannerPrompt.trim()) {
      ctx.textAlign = 'center'
      ctx.font = 'italic 600 22px Inter, sans-serif'
      ctx.fillStyle = 'rgba(232, 232, 240, 0.7)'
      ctx.fillText(bannerPrompt.trim().slice(0, 60), 750, 450)
    }

    // Border
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.15)'
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, 1498, 498)

    const url = canvas.toDataURL('image/png')
    setBannerUrl(url)
    setBannerGenerating(false)
  }

  const handleDownloadBanner = () => {
    if (!bannerUrl) return
    const a = document.createElement('a')
    a.href = bannerUrl
    a.download = `${token?.symbol || 'token'}-banner-1500x500.png`
    a.click()
  }

  const tweetText = token
    ? `Check out $${token.symbol} on @PumpDexApp!\n\nPrice: ${formatPrice(token.price)}\nMcap: ${formatCompact(token.market_cap)}\n\nScan any PumpFun token:\npumpdex.io/#token/${mint}`
    : ''

  return (
    <div className={`tap ${visible ? 'tap--visible' : ''}`}>
      {/* Hidden canvas for banner generation */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Background effects */}
      <div className="tap__bg-grid" />
      <div className="tap__bg-orb tap__bg-orb--1" />
      <div className="tap__bg-orb tap__bg-orb--2" />

      {/* Nav */}
      <nav className="tap__nav">
        <button className="tap__nav-back" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m15 18-6-6 6-6"/></svg>
          Home
        </button>
        <div className="tap__nav-brand">
          <img src="/owl_capsule-removebg-preview.png" alt="" className="tap__nav-owl" />
          <span className="tap__nav-logo">PumpDex</span>
        </div>
        <button className="tap__nav-cta" onClick={onLaunchApp}>
          Launch Scanner
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </button>
      </nav>

      {/* Loading */}
      {loading && (
        <div className="tap__loading">
          <div className="tap__spinner" />
          <span>Fetching token data...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="tap__error">
          <div className="tap__error-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
          </div>
          <h2>Token Not Found</h2>
          <p>We couldn't find data for this contract address. It may not be indexed yet.</p>
          <code className="tap__error-mint">{mint}</code>
          <div className="tap__error-actions">
            <button className="tap__btn tap__btn--primary" onClick={onLaunchApp}>Browse All Tokens</button>
            <button className="tap__btn tap__btn--secondary" onClick={onBack}>Go Home</button>
          </div>
        </div>
      )}

      {/* Main content */}
      {token && !loading && (
        <div className="tap__content">
          {/* Token header card */}
          <div className="tap__hero-card">
            <div className="tap__hero-card-glow" />
            <div className="tap__hero-left">
              {token.image_uri ? (
                <img src={token.image_uri} alt="" className="tap__token-img" onError={e => e.target.style.display = 'none'} />
              ) : (
                <div className="tap__token-placeholder">
                  {(token.symbol || '??').slice(0, 2)}
                </div>
              )}
              <div className="tap__token-info">
                <h1 className="tap__token-name">{token.name}</h1>
                <div className="tap__token-meta">
                  <span className="tap__token-symbol">${(token.symbol || '').toUpperCase()}</span>
                  <span className={`tap__token-badge ${!token.is_migrated ? 'tap__token-badge--pump' : ''}`}>{token.is_migrated ? 'Migrated' : 'Not Migrated'}</span>
                </div>
              </div>
            </div>
            <div className="tap__hero-right">
              <div className="tap__price">{formatPrice(token.price)}</div>
              <div className="tap__mcap">Market Cap: {formatCompact(token.market_cap)}</div>
            </div>
          </div>

          {/* Contract address bar */}
          <div className="tap__ca-bar">
            <span className="tap__ca-label">Contract Address</span>
            <code className="tap__ca-value">{mint}</code>
            <button className="tap__ca-copy" onClick={handleCopy}>
              {copied ? (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg> Copied</>
              ) : (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg> Copy</>
              )}
            </button>
          </div>

          {/* Stats grid */}
          <div className="tap__stats">
            <div className="tap__stat-card">
              <span className="tap__stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </span>
              <span className="tap__stat-label">Price</span>
              <span className="tap__stat-value">{formatPrice(token.price)}</span>
            </div>
            <div className="tap__stat-card">
              <span className="tap__stat-icon tap__stat-icon--blue">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
              </span>
              <span className="tap__stat-label">Market Cap</span>
              <span className="tap__stat-value">{formatCompact(token.market_cap)}</span>
            </div>
            <div className="tap__stat-card">
              <span className={`tap__stat-icon ${token.is_migrated ? 'tap__stat-icon--purple' : 'tap__stat-icon--yellow'}`}>
                {token.is_migrated ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m2 12 5.45 2.73L12 22l4.55-7.27L22 12l-5.45-2.73L12 2 7.45 9.27z"/></svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 8v4M12 16h.01"/></svg>
                )}
              </span>
              <span className="tap__stat-label">{token.is_migrated ? 'Liquidity' : 'Status'}</span>
              <span className={`tap__stat-value ${!token.is_migrated ? 'tap__stat-value--warn' : ''}`}>
                {token.is_migrated ? formatCompact(token.liquidity) : 'Not Migrated'}
              </span>
            </div>
            <div className="tap__stat-card">
              <span className="tap__stat-icon tap__stat-icon--yellow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              </span>
              <span className="tap__stat-label">Holders</span>
              <span className="tap__stat-value">{token.holder_count?.toLocaleString() || '-'}</span>
            </div>
            <div className="tap__stat-card">
              <span className="tap__stat-icon tap__stat-icon--red">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m2 14 6-6 6 6 6-6"/></svg>
              </span>
              <span className="tap__stat-label">Volume 24h</span>
              <span className="tap__stat-value">{formatCompact(token.volume_24h)}</span>
            </div>
            <div className="tap__stat-card">
              <span className="tap__stat-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              </span>
              <span className="tap__stat-label">Supply</span>
              <span className="tap__stat-value">{token.supply ? `${(parseFloat(token.supply) / 1e6).toFixed(1)}M` : '-'}</span>
            </div>
          </div>

          {/* Action cards */}
          <h2 className="tap__section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m13 2-2 14h5L8 22l2-14H5z"/></svg>
            Quick Actions
          </h2>

          <div className="tap__actions">
            {/* View on PumpDex */}
            <button className="tap__action-card tap__action-card--accent" onClick={() => { window.location.hash = '#app' }}>
              <div className="tap__action-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
              </div>
              <div className="tap__action-text">
                <h3>View Charts & Trades</h3>
                <p>Full candlestick chart, live transactions, indicators, and more</p>
              </div>
              <svg className="tap__action-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>

            {/* Buy on Jupiter */}
            <a className="tap__action-card" href={`https://jup.ag/swap/SOL-${mint}`} target="_blank" rel="noopener noreferrer">
              <div className="tap__action-icon tap__action-icon--blue">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <div className="tap__action-text">
                <h3>Buy on Jupiter</h3>
                <p>Swap SOL for {token.symbol || 'this token'} on Jupiter aggregator</p>
              </div>
              <svg className="tap__action-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17 17 7M17 7H7M17 7v10"/></svg>
            </a>

            {/* View on Solscan */}
            <a className="tap__action-card" href={`https://solscan.io/token/${mint}`} target="_blank" rel="noopener noreferrer">
              <div className="tap__action-icon tap__action-icon--purple">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              </div>
              <div className="tap__action-text">
                <h3>View on Solscan</h3>
                <p>Explore on-chain data, holders, transfers, and program interactions</p>
              </div>
              <svg className="tap__action-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17 17 7M17 7H7M17 7v10"/></svg>
            </a>

            {/* View on PumpFun */}
            <a className="tap__action-card" href={`https://pump.fun/${mint}`} target="_blank" rel="noopener noreferrer">
              <div className="tap__action-icon tap__action-icon--yellow">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2"/><path d="m2 12 5.45 2.73L12 22l4.55-7.27L22 12l-5.45-2.73L12 2 7.45 9.27z"/></svg>
              </div>
              <div className="tap__action-text">
                <h3>View on Pump.fun</h3>
                <p>See the original PumpFun listing, bonding curve, and community</p>
              </div>
              <svg className="tap__action-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 17 17 7M17 7H7M17 7v10"/></svg>
            </a>
          </div>

          {/* Banner Generator */}
          <h2 className="tap__section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
            Banner Generator
            <span className="tap__section-badge">1500 x 500</span>
          </h2>

          <div className="tap__banner-section">
            <p className="tap__banner-desc">Generate a professional Twitter/X header banner for your token. Perfect for community posts and promotions.</p>
            <div className="tap__banner-form">
              <input
                type="text"
                className="tap__banner-input"
                placeholder="Add a tagline (optional)... e.g. 'To the moon!'"
                value={bannerPrompt}
                onChange={e => setBannerPrompt(e.target.value)}
                maxLength={60}
              />
              <button
                className="tap__btn tap__btn--primary"
                onClick={handleGenerateBanner}
                disabled={bannerGenerating}
              >
                {bannerGenerating ? (
                  <><div className="tap__btn-spinner" /> Generating...</>
                ) : (
                  <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m13 2-2 14h5L8 22l2-14H5z"/></svg> Generate Banner</>
                )}
              </button>
            </div>

            {bannerUrl && (
              <div className="tap__banner-preview">
                <img src={bannerUrl} alt="Generated banner" className="tap__banner-img" />
                <div className="tap__banner-actions">
                  <button className="tap__btn tap__btn--primary" onClick={handleDownloadBanner}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/></svg>
                    Download PNG
                  </button>
                  <button className="tap__btn tap__btn--secondary" onClick={handleGenerateBanner}>
                    Regenerate
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Share on X */}
          <h2 className="tap__section-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l11.733 16h4.267l-11.733 -16h-4.267z"/><path d="M4 20l6.768 -6.768M13.232 10.768L20 4"/></svg>
            Spread the Word
          </h2>

          <div className="tap__share-section">
            <div className="tap__share-card">
              <div className="tap__share-left">
                <h3>Share on X / Twitter</h3>
                <p>Tag <strong>@PumpDexApp</strong> and share this token with the community. Help us grow and we'll feature top shared tokens!</p>
                <div className="tap__share-preview">
                  <span className="tap__share-preview-label">Preview:</span>
                  <pre className="tap__share-preview-text">{tweetText}</pre>
                </div>
              </div>
              <div className="tap__share-right">
                <a
                  className="tap__btn tap__btn--x"
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  Post on X
                </a>
                <p className="tap__share-note">Tag @PumpDexApp to get featured</p>
              </div>
            </div>
          </div>

          {/* Description if available */}
          {token.description && (
            <div className="tap__desc-section">
              <h2 className="tap__section-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
                About {token.name}
              </h2>
              <p className="tap__desc-text">{token.description}</p>
            </div>
          )}

          {/* Social links */}
          {(token.twitter || token.telegram || token.website) && (
            <div className="tap__links-row">
              {token.twitter && (
                <a className="tap__link-pill" href={token.twitter} target="_blank" rel="noopener noreferrer">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  Twitter
                </a>
              )}
              {token.telegram && (
                <a className="tap__link-pill" href={token.telegram} target="_blank" rel="noopener noreferrer">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/></svg>
                  Telegram
                </a>
              )}
              {token.website && (
                <a className="tap__link-pill" href={token.website} target="_blank" rel="noopener noreferrer">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  Website
                </a>
              )}
            </div>
          )}

          {/* Footer CTA */}
          <div className="tap__footer-cta">
            <p>Want to explore more PumpFun tokens?</p>
            <button className="tap__btn tap__btn--primary tap__btn--lg" onClick={onLaunchApp}>
              Launch Full Scanner
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

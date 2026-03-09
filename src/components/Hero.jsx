import { useState, useEffect } from 'react'
import './Hero.css'

export default function Hero({ onLaunchApp }) {
  const [visible, setVisible] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    const q = search.trim()
    // Detect Solana address (base58, 32-44 chars)
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(q)) {
      window.location.hash = `#token/${q}`
      return
    }
    onLaunchApp()
  }

  return (
    <section className={`hero ${visible ? 'hero--visible' : ''}`}>
      <video
        className="hero__bg-video"
        autoPlay
        loop
        muted
        playsInline
        src="/Untitled design (3).mp4"
      />
      <div className="hero__bg-overlay" />
      <div className="hero__bg-gradient" />

      <div className="hero__inner">
        <div className="hero__owl-row">
          <img src="/owl_capsule-removebg-preview.png" alt="" className="hero__owl" />
        </div>

        <h1 className="hero__title">
          <em>Track Every</em> PumpFun Coin
        </h1>

        <p className="hero__sub">
          Your All-in-One PumpFun Token Scanner & Community Platform
        </p>

        {/* Central search bar */}
        <form className="hero__search-bar" onSubmit={handleSearch}>
          <svg className="hero__search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            className="hero__search-input"
            placeholder="Search token or paste contract address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className="hero__search-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="m2 14 6-6 6 6 6-6"/></svg>
            Scan Tokens
          </button>
        </form>

        {/* Quick action pills */}
        <div className="hero__pills">
          <button className="hero__pill" onClick={onLaunchApp}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            Token Scanner
          </button>
          <a href="#bot" className="hero__pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="m2 14 6-6 6 6 6-6"/></svg>
            AI Bot
          </a>
          <a href="#features" className="hero__pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Free Updates
          </a>
          <a href="#features" className="hero__pill hero__pill--highlight">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
            Communities
          </a>
        </div>

        {/* Stats row */}
        <div className="hero__stats">
          <div className="hero__stat">
            <span className="hero__stat-value">$0</span>
            <span className="hero__stat-label">Token Updates</span>
          </div>
          <div className="hero__stat-divider" />
          <div className="hero__stat">
            <span className="hero__stat-value">24/7</span>
            <span className="hero__stat-label">AI Bot</span>
          </div>
          <div className="hero__stat-divider" />
          <div className="hero__stat">
            <span className="hero__stat-value hero__stat-value--accent">PumpFun</span>
            <span className="hero__stat-label">Specialized</span>
          </div>
          <div className="hero__stat-divider" />
          <div className="hero__stat">
            <span className="hero__stat-value">Instant</span>
            <span className="hero__stat-label">Updates</span>
          </div>
        </div>
      </div>
    </section>
  )
}

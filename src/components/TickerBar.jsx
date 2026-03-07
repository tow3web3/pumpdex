import { useState, useEffect } from 'react'
import './TickerBar.css'

export default function TickerBar({ onBack }) {
  const [tokens, setTokens] = useState([])

  useEffect(() => {
    async function fetchTop() {
      try {
        const res = await fetch('/api/tokens?sort=market_cap&order=desc&limit=20')
        if (!res.ok) return
        const data = await res.json()
        setTokens(data.tokens || [])
      } catch {}
    }
    fetchTop()
    const interval = setInterval(fetchTop, 60000)
    return () => clearInterval(interval)
  }, [])

  // Duplicate for infinite scroll effect
  const items = tokens.length > 0 ? [...tokens, ...tokens] : []

  return (
    <div className="ticker">
      {onBack && (
        <button className="ticker__back" onClick={onBack} title="Back to home">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
      )}
      <div className="ticker__track">
        {items.length > 0 ? (
          items.map((t, i) => {
            const change = parseFloat(t.price_change_24h) || 0
            const isUp = change >= 0
            return (
              <span key={`${t.mint}-${i}`} className="ticker__item">
                <span className="ticker__rank">#{(i % tokens.length) + 1}</span>
                {t.image_uri && <img src={t.image_uri} alt="" className="ticker__img" />}
                <span className="ticker__name">${t.symbol}</span>
                <span className={`ticker__change ${isUp ? 'ticker__change--up' : 'ticker__change--down'}`}>
                  {isUp ? '+' : ''}{change.toFixed(1)}%
                </span>
              </span>
            )
          })
        ) : (
          <span className="ticker__loading">Loading market data...</span>
        )}
      </div>
    </div>
  )
}

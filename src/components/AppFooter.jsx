import { useState, useEffect } from 'react'
import './AppFooter.css'

const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price?ids=solana,bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true'

function formatUsd(n) {
  if (!n) return '$0'
  if (n >= 1000) return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  return `$${n.toFixed(2)}`
}

export default function AppFooter() {
  const [prices, setPrices] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function fetchPrices() {
      try {
        const res = await fetch(COINGECKO_API)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setPrices({
          sol: { price: data.solana?.usd || 0, change: data.solana?.usd_24h_change || 0 },
          btc: { price: data.bitcoin?.usd || 0, change: data.bitcoin?.usd_24h_change || 0 },
          eth: { price: data.ethereum?.usd || 0, change: data.ethereum?.usd_24h_change || 0 },
        })
      } catch {}
    }

    fetchPrices()
    const interval = setInterval(fetchPrices, 30000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  if (!prices) return null

  const coins = [
    { key: 'sol', label: 'SOL', color: '#9945ff', ...prices.sol },
    { key: 'btc', label: 'BTC', color: '#f7931a', ...prices.btc },
    { key: 'eth', label: 'ETH', color: '#627eea', ...prices.eth },
  ]

  return (
    <div className="app-footer">
      {coins.map(c => (
        <div key={c.key} className="app-footer__coin">
          <span className="app-footer__dot" style={{ background: c.color }} />
          <span className="app-footer__label">{c.label}</span>
          <span className="app-footer__price">{formatUsd(c.price)}</span>
          <span className={`app-footer__change ${c.change >= 0 ? 'app-footer__change--up' : 'app-footer__change--down'}`}>
            {c.change >= 0 ? '+' : ''}{c.change.toFixed(2)}%
          </span>
        </div>
      ))}
      <span className="app-footer__brand">PumpDex</span>
    </div>
  )
}

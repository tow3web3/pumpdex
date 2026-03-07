import { useState } from 'react'
import './Sidebar.css'

const navItems = [
  {
    id: 'scanner',
    label: 'Scanner',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
      </svg>
    ),
  },
  {
    id: 'new-pairs',
    label: 'New Pairs',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14"/>
      </svg>
    ),
  },
  {
    id: 'trending',
    label: 'Trending',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m2 14 6-6 6 6 6-6"/><path d="M2 18h20"/>
      </svg>
    ),
    badge: null,
  },
  {
    id: 'watchlist',
    label: 'Watchlist',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
  {
    id: 'update-info',
    label: 'Update Info',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
      </svg>
    ),
    tag: 'FREE',
  },
]

export default function Sidebar({ open, onToggle, page, onNavigate }) {
  const [searchVal, setSearchVal] = useState('')

  return (
    <aside className={`sidebar ${open ? 'sidebar--open' : 'sidebar--collapsed'}`}>
      {/* Logo */}
      <div className="sidebar__header">
        <div className="sidebar__logo" onClick={onToggle}>
          <img src="/owl_capsule-removebg-preview.png" alt="PumpDex" style={{ width: 28, height: 28, objectFit: 'contain' }} />
          {open && (
            <div className="sidebar__logo-text">
              <span className="sidebar__brand">PUMPDEX</span>
              <span className="sidebar__edition">Pump.fun edition</span>
            </div>
          )}
        </div>
        <button className="sidebar__toggle" onClick={onToggle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M15 18l-6-6 6-6"/> : <path d="M9 18l6-6-6-6"/>}
          </svg>
        </button>
      </div>

      {/* Search */}
      {open && (
        <div className="sidebar__search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Search..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
          />
        </div>
      )}

      {/* Nav */}
      <nav className="sidebar__nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar__nav-item ${page === item.id ? 'sidebar__nav-item--active' : ''}`}
            onClick={() => onNavigate(item.id)}
            title={!open ? item.label : undefined}
          >
            <span className="sidebar__nav-icon">{item.icon}</span>
            {open && (
              <>
                <span className="sidebar__nav-label">{item.label}</span>
                {item.tag && <span className="sidebar__nav-tag">{item.tag}</span>}
              </>
            )}
          </button>
        ))}
      </nav>

      {/* Chains */}
      {open && (
        <div className="sidebar__section">
          <span className="sidebar__section-label">CHAIN</span>
          <div className="sidebar__chain sidebar__chain--active">
            <div className="sidebar__chain-dot sidebar__chain-dot--sol" />
            <span>Solana</span>
          </div>
          <div className="sidebar__chain sidebar__chain--locked">
            <div className="sidebar__chain-dot sidebar__chain-dot--eth" />
            <span>Ethereum</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div className="sidebar__chain sidebar__chain--locked">
            <div className="sidebar__chain-dot sidebar__chain-dot--base" />
            <span>Base</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
        </div>
      )}

      {/* Watchlist */}
      {open && (
        <div className="sidebar__section">
          <span className="sidebar__section-label">WATCHLIST</span>
          <p className="sidebar__empty">No tokens in watchlist<br /><span>Click the star on any token to add it</span></p>
        </div>
      )}
    </aside>
  )
}

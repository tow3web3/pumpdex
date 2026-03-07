import { useState, useEffect } from 'react'
import './Navbar.css'

export default function Navbar({ onLaunchApp }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <div className="navbar__inner">
        <div className="navbar__left">
          <a href="#" className="navbar__logo">
            <img src="/owl_capsule-removebg-preview.png" alt="PumpDex" className="navbar__logo-owl" />
            <span className="navbar__logo-text">PUMPDEX</span>
          </a>

          <div className="navbar__divider" />

          <div className="navbar__links">
            <a href="#features" className="navbar__link">Features</a>
            <a href="#bot" className="navbar__link">Bot</a>
            <a href="#compare" className="navbar__link">Compare</a>
            <a href="#vision" className="navbar__link">Roadmap</a>
          </div>
        </div>

        <div className="navbar__actions">
          <button onClick={onLaunchApp} className="navbar__btn navbar__btn--primary">
            Launch App
          </button>
        </div>
      </div>
    </nav>
  )
}

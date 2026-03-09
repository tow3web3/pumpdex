import { useState, useEffect } from 'react'
import LandingPage from './pages/LandingPage'
import AppPage from './pages/AppPage'
import TokenActionPage from './pages/TokenActionPage'
import './App.css'

function parseHash() {
  const hash = window.location.hash
  if (hash.startsWith('#token/')) return { view: 'token', mint: hash.slice(7) }
  if (hash === '#app') return { view: 'app', mint: null }
  return { view: 'landing', mint: null }
}

function App() {
  const [loaded, setLoaded] = useState(false)
  const [view, setView] = useState('landing')
  const [tokenMint, setTokenMint] = useState(null)

  useEffect(() => {
    setLoaded(true)
    const { view: v, mint } = parseHash()
    setView(v)
    setTokenMint(mint)
  }, [])

  useEffect(() => {
    const onHash = () => {
      const { view: v, mint } = parseHash()
      setView(v)
      setTokenMint(mint)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <div className={`app ${loaded ? 'app--loaded' : ''}`}>
      {view === 'token' && tokenMint ? (
        <TokenActionPage
          mint={tokenMint}
          onBack={() => { window.location.hash = ''; setView('landing') }}
          onLaunchApp={() => { window.location.hash = '#app'; setView('app') }}
        />
      ) : view === 'app' ? (
        <AppPage onBack={() => { window.location.hash = ''; setView('landing') }} />
      ) : (
        <LandingPage onLaunchApp={() => { window.location.hash = '#app'; setView('app') }} />
      )}
    </div>
  )
}

export default App

import { useState, useEffect } from 'react'
import LandingPage from './pages/LandingPage'
import AppPage from './pages/AppPage'
import './App.css'

function App() {
  const [loaded, setLoaded] = useState(false)
  const [view, setView] = useState('landing') // 'landing' or 'app'

  useEffect(() => {
    setLoaded(true)
    // Check if URL has #app
    if (window.location.hash === '#app') {
      setView('app')
    }
  }, [])

  useEffect(() => {
    const onHash = () => {
      setView(window.location.hash === '#app' ? 'app' : 'landing')
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  return (
    <div className={`app ${loaded ? 'app--loaded' : ''}`}>
      {view === 'landing' ? (
        <LandingPage onLaunchApp={() => { window.location.hash = '#app'; setView('app') }} />
      ) : (
        <AppPage onBack={() => { window.location.hash = ''; setView('landing') }} />
      )}
    </div>
  )
}

export default App

import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import TickerBar from '../components/TickerBar'
import Dashboard from '../components/Dashboard'
import TokenDetail from '../components/TokenDetail'
import './AppPage.css'

export default function AppPage({ onBack }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [selectedToken, setSelectedToken] = useState(null)
  const [page, setPage] = useState('scanner')

  return (
    <div className="app-page">
      <TickerBar onBack={onBack} />
      <div className="app-page__layout">
        <Sidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          page={page}
          onNavigate={(p) => { setPage(p); setSelectedToken(null) }}
        />
        <main className={`app-page__main ${sidebarOpen ? '' : 'app-page__main--expanded'}`}>
          {selectedToken ? (
            <TokenDetail
              token={selectedToken}
              onBack={() => setSelectedToken(null)}
            />
          ) : (
            <Dashboard
              onSelectToken={setSelectedToken}
              page={page}
            />
          )}
        </main>
      </div>
    </div>
  )
}

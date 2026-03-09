import { useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import bs58 from 'bs58'
import Sidebar from '../components/Sidebar'
import TickerBar from '../components/TickerBar'
import Dashboard from '../components/Dashboard'
import TokenDetail from '../components/TokenDetail'
import './AppPage.css'

const API_BASE = '/api'

function UpdateInfoModal({ onClose }) {
  const { publicKey, signMessage, connected } = useWallet()
  const [mint, setMint] = useState('')
  const [token, setToken] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({ description: '', twitter: '', telegram: '', website: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  const handleLookup = async (e) => {
    e.preventDefault()
    const addr = mint.trim()
    if (!addr || addr.length < 32) {
      setError('Please enter a valid Solana token address')
      return
    }
    setLoading(true)
    setError(null)
    setToken(null)
    try {
      const res = await fetch(`${API_BASE}/token/${addr}`)
      if (!res.ok) throw new Error('Token not found')
      const data = await res.json()
      setToken(data)
      setForm({
        description: data.description || '',
        twitter: data.twitter || '',
        telegram: data.telegram || '',
        website: data.website || '',
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!connected || !publicKey || !signMessage) {
      setMsg({ type: 'error', text: 'Please connect the token creator wallet first.' })
      return
    }

    setSaving(true)
    setMsg(null)
    try {
      // Sign a message to prove wallet ownership
      const message = `Update token info for ${token.mint} on PumpDex`
      const msgBytes = new TextEncoder().encode(message)
      const signatureBytes = await signMessage(msgBytes)
      const signature = bs58.encode(signatureBytes)

      const res = await fetch(`${API_BASE}/token/${token.mint}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          walletAddress: publicKey.toBase58(),
          signature,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Update failed')
      }
      setMsg({ type: 'success', text: 'Token info updated successfully!' })
    } catch (err) {
      setMsg({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="uim__overlay" onClick={onClose}>
      <div className="uim__modal" onClick={e => e.stopPropagation()}>
        <div className="uim__header">
          <h3 className="uim__title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
            Update Token Info
            <span className="uim__free-tag">FREE</span>
          </h3>
          <button className="uim__close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <p className="uim__sub">
          Update your token's info on PumpDex — completely free. Connect the <strong>creator wallet</strong> to verify ownership.
        </p>

        {/* Wallet connection */}
        <div className="uim__wallet-section">
          <WalletMultiButton />
          {connected && publicKey && (
            <span className="uim__wallet-addr">
              {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
            </span>
          )}
        </div>

        {/* Step 1: Enter contract address */}
        {!token && (
          <form className="uim__lookup" onSubmit={handleLookup}>
            <label className="uim__label">Token Contract Address</label>
            <div className="uim__lookup-row">
              <input
                className="uim__input"
                type="text"
                placeholder="Paste your token's mint address..."
                value={mint}
                onChange={e => setMint(e.target.value)}
                autoFocus
              />
              <button className="uim__lookup-btn" type="submit" disabled={loading}>
                {loading ? <div className="uim__spinner" /> : 'Find'}
              </button>
            </div>
            {error && <p className="uim__error">{error}</p>}
          </form>
        )}

        {/* Step 2: Token found — show info + edit form */}
        {token && (
          <>
            <div className="uim__token-card">
              {token.image_uri ? (
                <img src={token.image_uri} alt="" className="uim__token-img" onError={e => { e.target.style.display = 'none' }} />
              ) : (
                <div className="uim__token-placeholder">{(token.symbol || '??').slice(0, 2)}</div>
              )}
              <div className="uim__token-info">
                <span className="uim__token-name">{token.name}</span>
                <span className="uim__token-symbol">${token.symbol}</span>
              </div>
              <button className="uim__change-btn" onClick={() => { setToken(null); setMsg(null) }}>Change</button>
            </div>

            <form className="uim__form" onSubmit={handleSave}>
              <div className="uim__field">
                <label className="uim__label">Description</label>
                <textarea
                  className="uim__textarea"
                  placeholder="Describe your token, project, or community..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  maxLength={500}
                />
                <span className="uim__hint">{form.description.length}/500</span>
              </div>

              <div className="uim__field">
                <label className="uim__label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  Twitter / X
                </label>
                <input className="uim__input" type="text" placeholder="username (without @)" value={form.twitter} onChange={e => setForm(f => ({ ...f, twitter: e.target.value.replace(/^@/, '') }))} />
              </div>

              <div className="uim__field">
                <label className="uim__label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0h-.056zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                  Telegram
                </label>
                <input className="uim__input" type="text" placeholder="group or channel name" value={form.telegram} onChange={e => setForm(f => ({ ...f, telegram: e.target.value }))} />
              </div>

              <div className="uim__field">
                <label className="uim__label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  Website
                </label>
                <input className="uim__input" type="text" placeholder="https://yourproject.com" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
              </div>

              {msg && (
                <div className={`uim__msg uim__msg--${msg.type}`}>
                  {msg.type === 'success' ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></svg>
                  )}
                  {msg.text}
                </div>
              )}

              <button className="uim__submit" type="submit" disabled={saving || !connected}>
                {saving ? <><div className="uim__spinner" /> Signing & Saving...</> : !connected ? 'Connect Wallet to Save' : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg> Sign & Save Changes</>}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function AppPage({ onBack }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [selectedToken, setSelectedToken] = useState(null)
  const [page, setPage] = useState('scanner')
  const [showUpdateModal, setShowUpdateModal] = useState(false)

  const handleNavigate = (p) => {
    if (p === 'update-info') {
      setShowUpdateModal(true)
      return
    }
    setPage(p)
    setSelectedToken(null)
  }

  return (
    <div className="app-page">
      <TickerBar onBack={onBack} />
      <div className="app-page__layout">
        <Sidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          page={page}
          onNavigate={handleNavigate}
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
      {showUpdateModal && <UpdateInfoModal onClose={() => setShowUpdateModal(false)} />}
    </div>
  )
}

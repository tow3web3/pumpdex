import { useState } from 'react'
import { useInView } from '../hooks/useInView'
import './BotSection.css'

const commands = [
  {
    cmd: '@PumpDex_Bot create a community for $PEPE with @PepeArmy & "The Official Pepe Community" & banner',
    response: [
      'Community "PepeArmy" created successfully!',
      'You have been assigned as Admin.',
      'Custom banner generated and applied.',
      'Description set: "The Official Pepe Community"',
    ],
  },
  {
    cmd: '@PumpDex_Bot update my social to https://pepe.fun',
    response: [
      'Website link updated: https://pepe.fun',
      'All PumpDex listings refreshed.',
      'Changes are now live!',
    ],
  },
  {
    cmd: '@PumpDex_Bot moderate my community',
    response: [
      'Moderation enabled for PepeArmy.',
      'Auto-filtering spam & scam links.',
      'Welcome messages activated.',
      'Running 24/7 moderation.',
    ],
  },
]

export default function BotSection() {
  const [ref, inView] = useInView()
  const [activeCmd, setActiveCmd] = useState(0)
  const [typing, setTyping] = useState(false)

  const handleSwitch = (i) => {
    if (i === activeCmd) return
    setTyping(true)
    setTimeout(() => {
      setActiveCmd(i)
      setTyping(false)
    }, 300)
  }

  return (
    <section id="bot" className="bot" ref={ref}>
      <div className="bot__inner">
        <div className="bot__content">
          <div className={`bot__text ${inView ? 'bot__text--visible' : ''}`}>
            <span className="section-label">PumpDex Bot</span>
            <h2 className="section-title">One Prompt.<br /><span className="text-accent">Everything Done.</span></h2>
            <p className="section-sub">
              No more waiting for customer service. No more paying for basic updates.
              PumpDex_Bot is your AI agent that handles communities, banners, socials, and moderation — instantly.
            </p>

            <div className="bot__capabilities">
              <div className="bot__cap">
                <div className="bot__cap-icon bot__cap-icon--green">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <span>Generate banners for migrating coins</span>
              </div>
              <div className="bot__cap">
                <div className="bot__cap-icon bot__cap-icon--green">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <span>Create & manage communities</span>
              </div>
              <div className="bot__cap">
                <div className="bot__cap-icon bot__cap-icon--green">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <span>Update socials automatically</span>
              </div>
              <div className="bot__cap">
                <div className="bot__cap-icon bot__cap-icon--green">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <span>24/7 AI moderation</span>
              </div>
            </div>
          </div>

          <div className={`bot__demo ${inView ? 'bot__demo--visible' : ''}`}>
            <div className="bot__demo-tabs">
              {['Create Community', 'Update Socials', 'Moderate'].map((label, i) => (
                <button
                  key={i}
                  className={`bot__demo-tab ${activeCmd === i ? 'bot__demo-tab--active' : ''}`}
                  onClick={() => handleSwitch(i)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="bot__terminal">
              <div className="bot__terminal-header">
                <div className="bot__terminal-dots">
                  <span /><span /><span />
                </div>
                <span className="bot__terminal-title">PumpDex_Bot Terminal</span>
                <div className="bot__terminal-status">
                  <span className="bot__terminal-status-dot" />
                  Online
                </div>
              </div>
              <div className={`bot__terminal-body ${typing ? 'bot__terminal-body--typing' : ''}`}>
                <div className="bot__t-line">
                  <span className="bot__t-prompt">{'>'}</span>
                  <span className="bot__t-input">{commands[activeCmd].cmd}</span>
                </div>
                <div className="bot__t-divider" />
                {commands[activeCmd].response.map((line, i) => (
                  <div key={i} className="bot__t-line bot__t-line--response" style={{ animationDelay: `${i * 0.12}s` }}>
                    <span className="bot__t-check">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>
                    </span>
                    <span className="bot__t-msg">{line}</span>
                  </div>
                ))}
                <div className="bot__t-line bot__t-line--cursor">
                  <span className="bot__t-prompt">{'>'}</span>
                  <span className="bot__t-cursor">|</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

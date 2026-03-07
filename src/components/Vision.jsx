import { useInView } from '../hooks/useInView'
import './Vision.css'

const steps = [
  {
    phase: 'Phase 1',
    title: 'Launch',
    status: 'live',
    items: ['PumpFun token scanner', 'Free token updates', 'PumpDex_Bot launch', 'Community creation'],
  },
  {
    phase: 'Phase 2',
    title: 'Scale',
    status: 'next',
    items: ['Multi-chain support', 'Advanced analytics', 'Portfolio tracking', 'API access'],
  },
  {
    phase: 'Phase 3',
    title: 'Dominate',
    status: 'upcoming',
    items: ['Full DEX aggregation', 'Trading integration', 'Mobile app', 'Governance token'],
  },
]

export default function Vision({ onLaunchApp }) {
  const [ref, inView] = useInView()

  return (
    <section id="vision" className="vision" ref={ref}>
      <div className="vision__inner">
        <div className={`vision__header ${inView ? 'vision__header--visible' : ''}`}>
          <span className="section-label">Vision</span>
          <h2 className="section-title">The <span className="text-accent">Roadmap</span></h2>
          <p className="section-sub">Removing the $299 barrier and giving power back to every token creator.</p>
        </div>

        <div className="vision__grid">
          {steps.map((step, i) => (
            <div
              key={i}
              className={`vision__card vision__card--${step.status} ${inView ? 'vision__card--visible' : ''}`}
              style={{ transitionDelay: `${i * 0.12}s` }}
            >
              <div className="vision__card-top">
                <span className="vision__phase">{step.phase}</span>
                <span className={`vision__status vision__status--${step.status}`}>
                  {step.status === 'live' && <span className="vision__status-dot" />}
                  {step.status}
                </span>
              </div>
              <h3 className="vision__card-title">{step.title}</h3>
              <ul className="vision__list">
                {step.items.map((item, j) => (
                  <li key={j} className="vision__list-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      {step.status === 'live'
                        ? <path d="M20 6 9 17l-5-5"/>
                        : <circle cx="12" cy="12" r="4"/>
                      }
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={`vision__cta ${inView ? 'vision__cta--visible' : ''}`}>
          <div className="vision__cta-card">
            <h3 className="vision__cta-title">Ready to ditch DexScreener?</h3>
            <p className="vision__cta-sub">Join the movement. Free updates. AI communities. Zero cost.</p>
            <div className="vision__cta-actions">
              <button onClick={onLaunchApp} className="vision__cta-btn vision__cta-btn--primary">Launch Scanner</button>
              <a href="#bot" className="vision__cta-btn vision__cta-btn--secondary">Try the Bot</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

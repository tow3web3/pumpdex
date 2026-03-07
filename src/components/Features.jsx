import { useInView } from '../hooks/useInView'
import './Features.css'

const features = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
    title: 'Zero Cost Updates',
    desc: 'No more $299 charges. Update your token logo, description, links and socials completely free. We handle everything.',
    tag: 'FREE',
    tagColor: 'green',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M9 21V9"/>
      </svg>
    ),
    title: 'PumpFun Scanner',
    desc: 'Clean, fast UI to scan every PumpFun coin. Real-time data, charts and token metrics — all in one place.',
    tag: 'LIVE',
    tagColor: 'blue',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="m2 14 6-6 6 6 6-6"/>
      </svg>
    ),
    title: 'AI-Powered Bot',
    desc: 'PumpDex_Bot generates banners, creates communities, updates socials, and moderates — all from a single prompt.',
    tag: 'AI',
    tagColor: 'purple',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    title: 'Instant Communities',
    desc: 'One command creates your community with custom name, description, banner — and makes you admin instantly.',
    tag: 'NEW',
    tagColor: 'yellow',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
      </svg>
    ),
    title: 'Auto Social Updates',
    desc: 'Tell the bot your new website, Twitter or Telegram link. It updates everything across PumpDex automatically.',
    tag: 'AUTO',
    tagColor: 'green',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12h.01M15 12h.01M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/>
      </svg>
    ),
    title: 'AI Moderation',
    desc: 'PumpDex_Bot can moderate your community 24/7. Keep it clean and active without lifting a finger.',
    tag: 'BOT',
    tagColor: 'blue',
  },
]

const tagColors = {
  green: { bg: 'rgba(0,255,136,0.1)', color: '#00ff88', border: 'rgba(0,255,136,0.2)' },
  blue: { bg: 'rgba(68,136,255,0.1)', color: '#4488ff', border: 'rgba(68,136,255,0.2)' },
  purple: { bg: 'rgba(170,102,255,0.1)', color: '#aa66ff', border: 'rgba(170,102,255,0.2)' },
  yellow: { bg: 'rgba(255,204,0,0.1)', color: '#ffcc00', border: 'rgba(255,204,0,0.2)' },
}

export default function Features() {
  const [ref, inView] = useInView()

  return (
    <section id="features" className="features" ref={ref}>
      <div className="features__inner">
        <div className={`features__header ${inView ? 'features__header--visible' : ''}`}>
          <span className="section-label">Features</span>
          <h2 className="section-title">Everything You Need.<br /><span className="text-accent">Nothing You Don't.</span></h2>
          <p className="section-sub">Built for PumpFun traders who are tired of paying $299 for basic token updates.</p>
        </div>
        <div className="features__grid">
          {features.map((f, i) => (
            <div
              key={i}
              className={`feature-card ${inView ? 'feature-card--visible' : ''}`}
              style={{ transitionDelay: `${i * 0.08}s` }}
            >
              <div className="feature-card__top">
                <div className="feature-card__icon">{f.icon}</div>
                <span
                  className="feature-card__tag"
                  style={{
                    background: tagColors[f.tagColor].bg,
                    color: tagColors[f.tagColor].color,
                    borderColor: tagColors[f.tagColor].border,
                  }}
                >
                  {f.tag}
                </span>
              </div>
              <h3 className="feature-card__title">{f.title}</h3>
              <p className="feature-card__desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

import { useInView } from '../hooks/useInView'
import './Comparison.css'

const rows = [
  { feature: 'Token Info Update', dex: '$299', pump: 'FREE', highlight: true },
  { feature: 'Update Speed', dex: '24-72 hours', pump: 'Instant', highlight: false },
  { feature: 'Banner Generation', dex: 'Not available', pump: 'AI Generated', highlight: false },
  { feature: 'Community Creation', dex: 'Not available', pump: 'One prompt', highlight: true },
  { feature: 'Social Updates', dex: 'Manual + paid', pump: 'Automatic', highlight: false },
  { feature: 'AI Moderation', dex: 'Not available', pump: '24/7 Bot', highlight: true },
  { feature: 'Customer Service', dex: 'Slow/No response', pump: 'AI Agent instant', highlight: false },
  { feature: 'PumpFun Focus', dex: 'Generic', pump: 'Specialized', highlight: false },
]

export default function Comparison() {
  const [ref, inView] = useInView()

  return (
    <section id="compare" className="comparison" ref={ref}>
      <div className="comparison__inner">
        <div className={`comparison__header ${inView ? 'comparison__header--visible' : ''}`}>
          <span className="section-label">Why PumpDex</span>
          <h2 className="section-title">DexScreener vs <span className="text-accent">PumpDex</span></h2>
          <p className="section-sub">See why thousands of traders are switching.</p>
        </div>

        <div className={`comparison__table ${inView ? 'comparison__table--visible' : ''}`}>
          <div className="comparison__row comparison__row--header">
            <span className="comparison__col comparison__col--feature">Feature</span>
            <span className="comparison__col comparison__col--dex">DexScreener</span>
            <span className="comparison__col comparison__col--pump">PumpDex</span>
          </div>
          {rows.map((row, i) => (
            <div
              key={i}
              className={`comparison__row ${row.highlight ? 'comparison__row--highlight' : ''}`}
              style={{ transitionDelay: `${i * 0.05}s` }}
            >
              <span className="comparison__col comparison__col--feature">{row.feature}</span>
              <span className="comparison__col comparison__col--dex comparison__col--bad">{row.dex}</span>
              <span className="comparison__col comparison__col--pump comparison__col--good">{row.pump}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__top">
          <div className="footer__brand">
            <div className="footer__logo">
              <img src="/owl_capsule-removebg-preview.png" alt="PumpDex" style={{ width: 28, height: 28, objectFit: 'contain' }} />
              <span>PumpDex</span>
            </div>
            <p className="footer__tagline">The DexScreener alternative built for PumpFun.</p>
          </div>

          <div className="footer__links-group">
            <h4>Product</h4>
            <a href="#scanner">Token Scanner</a>
            <a href="#bot">PumpDex Bot</a>
            <a href="#features">Features</a>
          </div>

          <div className="footer__links-group">
            <h4>Community</h4>
            <a href="#" target="_blank" rel="noopener">Twitter</a>
            <a href="#" target="_blank" rel="noopener">Telegram</a>
            <a href="#" target="_blank" rel="noopener">Discord</a>
          </div>

          <div className="footer__links-group">
            <h4>Resources</h4>
            <a href="#vision">Roadmap</a>
            <a href="#">Docs</a>
            <a href="#">API</a>
          </div>
        </div>

        <div className="footer__bottom">
          <span className="footer__copy">&copy; 2025 PumpDex. All rights reserved.</span>
          <span className="footer__built">Built for the culture.</span>
        </div>
      </div>
    </footer>
  )
}

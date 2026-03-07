import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Features from '../components/Features'
import BotSection from '../components/BotSection'
import Comparison from '../components/Comparison'
import Vision from '../components/Vision'
import Footer from '../components/Footer'
import './LandingPage.css'

export default function LandingPage({ onLaunchApp }) {
  return (
    <div className="landing">
      <Navbar onLaunchApp={onLaunchApp} />
      <Hero onLaunchApp={onLaunchApp} />
      <Features />
      <BotSection />
      <Comparison />
      <Vision onLaunchApp={onLaunchApp} />
      <Footer />
    </div>
  )
}

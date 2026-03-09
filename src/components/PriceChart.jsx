import { useState, useEffect, useRef, useCallback } from 'react'
import {
  createChart, ColorType,
  CandlestickSeries, LineSeries, AreaSeries, HistogramSeries,
} from 'lightweight-charts'
import './PriceChart.css'

// Compute Simple Moving Average
function calcSMA(data, period) {
  const result = []
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += data[j].close
    result.push({ time: data[i].time, value: sum / period })
  }
  return result
}

// Compute Exponential Moving Average
function calcEMA(data, period) {
  const result = []
  const k = 2 / (period + 1)
  let ema = data[0].close
  result.push({ time: data[0].time, value: ema })
  for (let i = 1; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k)
    if (i >= period - 1) result.push({ time: data[i].time, value: ema })
  }
  return result
}

// Compute Bollinger Bands (20-period, 2 std dev)
function calcBB(data, period = 20, mult = 2) {
  const upper = [], lower = [], mid = []
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += data[j].close
    const mean = sum / period
    let variance = 0
    for (let j = i - period + 1; j <= i; j++) variance += (data[j].close - mean) ** 2
    const std = Math.sqrt(variance / period)
    mid.push({ time: data[i].time, value: mean })
    upper.push({ time: data[i].time, value: mean + mult * std })
    lower.push({ time: data[i].time, value: mean - mult * std })
  }
  return { upper, lower, mid }
}

const CHART_TYPES = [
  { id: 'candles', label: 'Candles', icon: 'M6 2v20M18 2v20M6 6h12M6 18h12' },
  { id: 'line', label: 'Line', icon: 'M3 17l6-6 4 4 8-8' },
  { id: 'area', label: 'Area', icon: 'M3 17l6-6 4 4 8-8v11H3z' },
]

const INDICATORS = [
  { id: 'ma7', label: 'MA 7', color: '#ffaa00' },
  { id: 'ma25', label: 'MA 25', color: '#00aaff' },
  { id: 'ma99', label: 'MA 99', color: '#aa44ff' },
  { id: 'ema12', label: 'EMA 12', color: '#ff6600' },
  { id: 'ema26', label: 'EMA 26', color: '#00ffaa' },
  { id: 'bb', label: 'BOLL', color: '#8888aa' },
  { id: 'vol', label: 'VOL', color: '#3a3a5c' },
]

export default function PriceChart({ data, loading, height = 300 }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const seriesRef = useRef({})
  const [chartType, setChartType] = useState('candles')
  const [activeIndicators, setActiveIndicators] = useState(['vol'])
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false)
  const wrapperRef = useRef(null)

  const toggleIndicator = (id) => {
    setActiveIndicators(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const toggleFullscreen = useCallback(() => {
    if (!wrapperRef.current) return
    if (!document.fullscreenElement) {
      wrapperRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  useEffect(() => {
    if (!containerRef.current || !data || data.length === 0) return

    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
      seriesRef.current = {}
    }

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#6b6b80',
        fontFamily: "'JetBrains Mono', 'Inter', monospace",
        fontSize: 10,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: 'rgba(255,255,255,0.04)', style: 1 },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: 'rgba(255,255,255,0.15)', width: 1, style: 3, labelBackgroundColor: '#1a1a2e' },
        horzLine: { color: 'rgba(255,255,255,0.15)', width: 1, style: 3, labelBackgroundColor: '#1a1a2e' },
      },
      rightPriceScale: {
        borderVisible: false,
        scaleMargins: { top: 0.08, bottom: activeIndicators.includes('vol') ? 0.25 : 0.08 },
        entireTextOnly: true,
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 5,
        barSpacing: 8,
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    })

    const priceFormat = { type: 'price', precision: 8, minMove: 0.00000001 }

    // Main series
    if (chartType === 'candles') {
      const s = chart.addSeries(CandlestickSeries, {
        upColor: '#00ff88', downColor: '#ff4466',
        borderUpColor: '#00ff88', borderDownColor: '#ff4466',
        wickUpColor: '#00ff88', wickDownColor: '#ff4466',
        priceFormat,
        lastValueVisible: true, priceLineVisible: true, priceLineWidth: 1, priceLineStyle: 2,
      })
      s.setData(data)
      seriesRef.current.main = s
    } else if (chartType === 'line') {
      const isUp = data.length >= 2 && data[data.length - 1].close >= data[0].close
      const s = chart.addSeries(LineSeries, {
        color: isUp ? '#00ff88' : '#ff4466',
        lineWidth: 2,
        priceFormat,
        lastValueVisible: true, priceLineVisible: true, priceLineWidth: 1, priceLineStyle: 2,
        crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
      })
      s.setData(data.map(d => ({ time: d.time, value: d.close })))
      seriesRef.current.main = s
    } else {
      const isUp = data.length >= 2 && data[data.length - 1].close >= data[0].close
      const s = chart.addSeries(AreaSeries, {
        lineColor: isUp ? '#00ff88' : '#ff4466',
        topColor: isUp ? 'rgba(0,255,136,0.18)' : 'rgba(255,68,102,0.18)',
        bottomColor: 'transparent',
        lineWidth: 2,
        priceFormat,
        lastValueVisible: true, priceLineVisible: true, priceLineWidth: 1, priceLineStyle: 2,
      })
      s.setData(data.map(d => ({ time: d.time, value: d.close })))
      seriesRef.current.main = s
    }

    // Volume
    if (activeIndicators.includes('vol')) {
      const volSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: 'volume' },
        priceScaleId: 'vol',
        lastValueVisible: false,
        priceLineVisible: false,
      })
      chart.priceScale('vol').applyOptions({
        scaleMargins: { top: 0.8, bottom: 0 },
        visible: false,
      })
      volSeries.setData(data.map(d => ({
        time: d.time,
        value: d.volume || 0,
        color: d.close >= d.open ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,102,0.2)',
      })))
      seriesRef.current.vol = volSeries
    }

    // Moving Averages
    const maConfigs = [
      { id: 'ma7', period: 7, color: '#ffaa00' },
      { id: 'ma25', period: 25, color: '#00aaff' },
      { id: 'ma99', period: 99, color: '#aa44ff' },
    ]
    for (const { id, period, color } of maConfigs) {
      if (activeIndicators.includes(id) && data.length >= period) {
        const maData = calcSMA(data, period)
        const s = chart.addSeries(LineSeries, {
          color, lineWidth: 1, priceFormat,
          lastValueVisible: false, priceLineVisible: false,
          crosshairMarkerVisible: false,
        })
        s.setData(maData)
        seriesRef.current[id] = s
      }
    }

    // EMAs
    const emaConfigs = [
      { id: 'ema12', period: 12, color: '#ff6600' },
      { id: 'ema26', period: 26, color: '#00ffaa' },
    ]
    for (const { id, period, color } of emaConfigs) {
      if (activeIndicators.includes(id) && data.length >= period) {
        const emaData = calcEMA(data, period)
        const s = chart.addSeries(LineSeries, {
          color, lineWidth: 1, lineStyle: 2, priceFormat,
          lastValueVisible: false, priceLineVisible: false,
          crosshairMarkerVisible: false,
        })
        s.setData(emaData)
        seriesRef.current[id] = s
      }
    }

    // Bollinger Bands
    if (activeIndicators.includes('bb') && data.length >= 20) {
      const bb = calcBB(data, 20, 2)
      const sUpper = chart.addSeries(LineSeries, {
        color: 'rgba(136,136,170,0.5)', lineWidth: 1, priceFormat,
        lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
      })
      sUpper.setData(bb.upper)
      const sLower = chart.addSeries(LineSeries, {
        color: 'rgba(136,136,170,0.5)', lineWidth: 1, priceFormat,
        lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
      })
      sLower.setData(bb.lower)
      const sMid = chart.addSeries(LineSeries, {
        color: 'rgba(136,136,170,0.3)', lineWidth: 1, lineStyle: 2, priceFormat,
        lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
      })
      sMid.setData(bb.mid)
      seriesRef.current.bbUpper = sUpper
      seriesRef.current.bbLower = sLower
      seriesRef.current.bbMid = sMid
    }

    chart.timeScale().fitContent()
    chartRef.current = chart

    return () => {
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        seriesRef.current = {}
      }
    }
  }, [data, chartType, activeIndicators])

  return (
    <div className={`price-chart ${isFullscreen ? 'price-chart--fullscreen' : ''}`} ref={wrapperRef}>
      {/* Toolbar */}
      <div className="price-chart__toolbar">
        <div className="price-chart__toolbar-group">
          {CHART_TYPES.map(t => (
            <button
              key={t.id}
              className={`price-chart__tool-btn ${chartType === t.id ? 'price-chart__tool-btn--active' : ''}`}
              onClick={() => setChartType(t.id)}
              title={t.label}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon}/></svg>
            </button>
          ))}
        </div>

        <div className="price-chart__toolbar-sep" />

        <div className="price-chart__toolbar-group">
          <div className="price-chart__indicator-wrap">
            <button
              className={`price-chart__tool-btn price-chart__tool-btn--label ${showIndicatorMenu ? 'price-chart__tool-btn--active' : ''}`}
              onClick={() => setShowIndicatorMenu(!showIndicatorMenu)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m2 14 6-6 6 6 6-6"/></svg>
              Indicators
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            {showIndicatorMenu && (
              <div className="price-chart__indicator-menu">
                {INDICATORS.map(ind => (
                  <button
                    key={ind.id}
                    className={`price-chart__indicator-item ${activeIndicators.includes(ind.id) ? 'price-chart__indicator-item--active' : ''}`}
                    onClick={() => toggleIndicator(ind.id)}
                  >
                    <span className="price-chart__indicator-dot" style={{ background: ind.color }} />
                    {ind.label}
                    {activeIndicators.includes(ind.id) && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6 9 17l-5-5"/></svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Active indicator pills */}
        <div className="price-chart__toolbar-group price-chart__active-pills">
          {activeIndicators.filter(id => id !== 'vol').map(id => {
            const ind = INDICATORS.find(x => x.id === id)
            if (!ind) return null
            return (
              <span key={id} className="price-chart__pill" style={{ borderColor: ind.color, color: ind.color }}>
                {ind.label}
                <button className="price-chart__pill-x" onClick={() => toggleIndicator(id)}>&times;</button>
              </span>
            )
          })}
        </div>

        <div className="price-chart__toolbar-spacer" />

        <div className="price-chart__toolbar-group">
          <button className="price-chart__tool-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {isFullscreen ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
            )}
          </button>
        </div>
      </div>

      {loading && (
        <div className="price-chart__loading">
          <div className="price-chart__spinner" />
          Loading chart...
        </div>
      )}
      {!loading && (!data || data.length === 0) && (
        <div className="price-chart__empty">
          No price history yet. Data builds over time.
        </div>
      )}
      <div
        ref={containerRef}
        className="price-chart__container"
        style={{ visibility: data && data.length > 0 ? 'visible' : 'hidden', height: isFullscreen ? 'calc(100vh - 48px)' : height }}
      />
    </div>
  )
}

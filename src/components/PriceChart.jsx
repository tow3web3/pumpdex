import { useEffect, useRef } from 'react'
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts'
import './PriceChart.css'

export default function PriceChart({ data, loading, height = 300 }) {
  const containerRef = useRef(null)
  const chartRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !data || data.length === 0) return

    // Clear previous chart
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height,
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
        scaleMargins: { top: 0.08, bottom: 0.08 },
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

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#00ff88',
      downColor: '#ff4466',
      borderUpColor: '#00ff88',
      borderDownColor: '#ff4466',
      wickUpColor: '#00ff88',
      wickDownColor: '#ff4466',
      priceFormat: {
        type: 'price',
        precision: 8,
        minMove: 0.00000001,
      },
      lastValueVisible: true,
      priceLineVisible: true,
      priceLineWidth: 1,
      priceLineStyle: 2,
    })

    candleSeries.setData(data)
    chart.timeScale().fitContent()
    chartRef.current = chart

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [data, height])

  return (
    <div className="price-chart">
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
        style={{ visibility: data && data.length > 0 ? 'visible' : 'hidden', height: `${height}px` }}
      />
    </div>
  )
}

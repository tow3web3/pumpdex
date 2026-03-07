import { useEffect, useRef } from 'react'
import { createChart, ColorType, AreaSeries } from 'lightweight-charts'
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
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#555570',
        fontFamily: "'Inter', sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.03)' },
        horzLines: { color: 'rgba(255,255,255,0.03)' },
      },
      crosshair: {
        vertLine: { color: 'rgba(0,255,136,0.3)', width: 1, style: 2 },
        horzLine: { color: 'rgba(0,255,136,0.3)', width: 1, style: 2 },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.05)',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.05)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    })

    const isUp = data.length >= 2 && data[data.length - 1].value >= data[0].value

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: isUp ? '#00ff88' : '#ff4466',
      topColor: isUp ? 'rgba(0,255,136,0.2)' : 'rgba(255,68,102,0.2)',
      bottomColor: isUp ? 'rgba(0,255,136,0.01)' : 'rgba(255,68,102,0.01)',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 8,
        minMove: 0.00000001,
      },
    })

    areaSeries.setData(data)
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
  }, [data])

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

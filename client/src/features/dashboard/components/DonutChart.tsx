import { memo, useMemo } from 'react'
import { useI18n } from '../../../locales/I18nContext'

interface DonutChartProps {
  data: Array<{ name: string; value: number }>
}

// Colors designed for both light and dark mode with good contrast
// Light mode: darker values | Dark mode: lighter values
const CHART_COLORS = [
  { light: '#1d4ed8', dark: '#60a5fa' }, // Blue
  { light: '#059669', dark: '#34d399' }, // Green
  { light: '#d97706', dark: '#fbbf24' }, // Amber
  { light: '#7c3aed', dark: '#a78bfa' }, // Purple
]

/**
 * Modern donut chart with clean, minimalistic design.
 * No hover effects, stable positioning, theme-aware colors.
 */
export const DonutChart = memo(function DonutChart({ data }: DonutChartProps) {
  const { t } = useI18n()

  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data])

  const segments = useMemo(() => {
    if (data.length === 0 || total === 0) {
      return []
    }

    return data.reduce<Array<{
      name: string
      value: number
      percent: number
      startAngle: number
      colorIndex: number
    }>>((accumulator, item, index) => {
      const previousSegment = accumulator[accumulator.length - 1]
      const startAngle = previousSegment
        ? previousSegment.startAngle + (previousSegment.percent / 100) * 360
        : -90 // Start from top
      const percent = (item.value / total) * 100

      return [
        ...accumulator,
        {
          ...item,
          percent,
          startAngle,
          colorIndex: index % CHART_COLORS.length,
        },
      ]
    }, [])
  }, [data, total])

  if (data.length === 0 || total === 0) {
    return <p className="donut-empty">{t('dashboard.noData')}</p>}
  // SVG parameters
  const size = 140
  const strokeWidth = 18
  const radius = (size - strokeWidth) / 2
  const center = size / 2

  return (
    <div className="donut-container">
      <svg
        className="donut-svg"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Donut chart: ${segments.length} categories`}
      >
        {segments.map((segment, index) => {
          // Convert angles to arc path
          const endAngle = segment.startAngle + (segment.percent / 100) * 360
          const startRad = (segment.startAngle * Math.PI) / 180
          const endRad = (endAngle * Math.PI) / 180

          const x1 = center + radius * Math.cos(startRad)
          const y1 = center + radius * Math.sin(startRad)
          const x2 = center + radius * Math.cos(endRad)
          const y2 = center + radius * Math.sin(endRad)

          const largeArcFlag = segment.percent > 50 ? 1 : 0

          return (
            <path
              key={index}
              d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`}
              fill="none"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              className={`donut-arc donut-arc-${segment.colorIndex}`}
            />
          )
        })}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="middle"
          className="donut-total"
        >
          {total}
        </text>
      </svg>

      <div className="donut-legend">
        {segments.map((segment, index) => (
          <div key={index} className="legend-row">
            <span className={`legend-dot legend-dot-${segment.colorIndex}`} />
            <span className="legend-name">{segment.name}</span>
            <span className="legend-count">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
})

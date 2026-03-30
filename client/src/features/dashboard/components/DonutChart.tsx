import { useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/I18nContext'

interface DonutChartProps {
  data: Array<{ name: string; value: number }>
}

const COLORS = ['var(--color-primary)', 'var(--color-accent)', 'var(--color-warning)', '#8884d8', '#82ca9d']

/**
 * Graphique donut (anneau).
 * Utilise une représentation CSS/SVG simple.
 */
export function DonutChart({ data }: DonutChartProps) {
  const { t } = useI18n()

  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data])

  if (data.length === 0 || total === 0) {
    return <p className="chart-empty">{t('dashboard.noData')}</p>
  }

  // Calculate segments for the donut
  const segments = useMemo(() => {
    let cumulativePercent = 0
    return data.map((item, index) => {
      const percent = (item.value / total) * 100
      const segment = {
        ...item,
        percent,
        startPercent: cumulativePercent,
        color: COLORS[index % COLORS.length],
      }
      cumulativePercent += percent
      return segment
    })
  }, [data, total])

  const radius = 80
  const strokeWidth = 30
  const circumference = 2 * Math.PI * radius

  return (
    <div className="donut-chart-container">
      <svg className="donut-chart" viewBox="0 0 200 200">
        {segments.map((segment, index) => {
          const offset = circumference * (1 - segment.startPercent / 100)
          const length = circumference * (segment.percent / 100)
          return (
            <circle
              key={index}
              cx="100"
              cy="100"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={offset}
              transform="rotate(-90 100 100)"
              className="donut-segment"
            />
          )
        })}
        <text x="100" y="100" textAnchor="middle" dominantBaseline="middle" className="donut-total">
          {total}
        </text>
      </svg>
      <div className="donut-legend">
        {segments.map((segment, index) => (
          <div key={index} className="legend-item">
            <span className="legend-color" style={{ backgroundColor: segment.color }} />
            <span className="legend-label">{segment.name}</span>
            <span className="legend-value">{segment.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

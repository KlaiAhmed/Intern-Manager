import { memo, useMemo } from 'react'
import { useI18n } from '../../../locales/I18nContext'

interface DonutChartProps {
  data: Array<{ name: string; value: number }>
}

const COLORS = ['var(--color-primary)', 'var(--color-accent)', 'var(--color-warning)', '#8884d8', '#82ca9d']

/**
 * Graphique donut (anneau).
 * Utilise une représentation CSS/SVG simple.
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
      startPercent: number
      color: string
    }>>((accumulator, item, index) => {
      const previousSegment = accumulator[accumulator.length - 1]
      const startPercent = previousSegment
        ? previousSegment.startPercent + previousSegment.percent
        : 0
      const percent = (item.value / total) * 100

      return [
        ...accumulator,
        {
          ...item,
          percent,
          startPercent,
          color: COLORS[index % COLORS.length],
        },
      ]
    }, [])
  }, [data, total])

  if (data.length === 0 || total === 0) {
    return <p className="chart-empty">{t('dashboard.noData')}</p>
  }

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
})


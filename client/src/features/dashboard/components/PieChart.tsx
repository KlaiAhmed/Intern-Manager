import { useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/I18nContext'

interface PieChartProps {
  data: Array<{ name: string; value: number }>
}

const COLORS = ['var(--color-primary)', 'var(--color-accent)', 'var(--color-warning)', '#8884d8', '#82ca9d', '#ffc658']

/**
 * Graphique camembert (pie chart).
 * Utilise une représentation SVG.
 */
export function PieChart({ data }: PieChartProps) {
  const { t } = useI18n()

  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data])

  if (data.length === 0 || total === 0) {
    return <p className="chart-empty">{t('dashboard.noData')}</p>
  }

  // Calculate pie slices
  const slices = useMemo(() => {
    let cumulativeAngle = 0
    return data.map((item, index) => {
      const angle = (item.value / total) * 360
      const slice = {
        ...item,
        startAngle: cumulativeAngle,
        endAngle: cumulativeAngle + angle,
        color: COLORS[index % COLORS.length],
      }
      cumulativeAngle += angle
      return slice
    })
  }, [data, total])

  const getPath = (startAngle: number, endAngle: number) => {
    const cx = 100
    const cy = 100
    const r = 80

    const startRad = (startAngle - 90) * (Math.PI / 180)
    const endRad = (endAngle - 90) * (Math.PI / 180)

    const x1 = cx + r * Math.cos(startRad)
    const y1 = cy + r * Math.sin(startRad)
    const x2 = cx + r * Math.cos(endRad)
    const y2 = cy + r * Math.sin(endRad)

    const largeArc = endAngle - startAngle > 180 ? 1 : 0

    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
  }

  return (
    <div className="pie-chart-container">
      <svg className="pie-chart" viewBox="0 0 200 200">
        {slices.map((slice, index) => (
          <path
            key={index}
            d={getPath(slice.startAngle, slice.endAngle)}
            fill={slice.color}
            className="pie-slice"
          />
        ))}
      </svg>
      <div className="pie-legend">
        {slices.map((slice, index) => (
          <div key={index} className="legend-item">
            <span className="legend-color" style={{ backgroundColor: slice.color }} />
            <span className="legend-label">{slice.name}</span>
            <span className="legend-value">{Math.round((slice.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

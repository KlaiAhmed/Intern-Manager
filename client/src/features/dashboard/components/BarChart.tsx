import { useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/I18nContext'

// Note: Install recharts with `npm install recharts` for proper chart rendering
// This component provides a fallback bar representation if recharts is not available

interface BarChartProps {
  data: Array<{ name: string; value: number }>
}

/**
 * Graphique à barres horizontales.
 * Si recharts n'est pas installé, affiche une représentation CSS simple.
 */
export function BarChart({ data }: BarChartProps) {
  const { t } = useI18n()

  const maxValue = useMemo(() => {
    return Math.max(...data.map((d) => d.value), 1)
  }, [data])

  if (data.length === 0) {
    return <p className="chart-empty">{t('dashboard.noData')}</p>
  }

  // Try to use recharts if available, otherwise use CSS fallback
  try {
    // Dynamic import would go here if recharts is installed
    // For now, using CSS-based fallback
    return (
      <div className="bar-chart-fallback">
        {data.map((item, index) => (
          <div key={index} className="bar-chart-row">
            <span className="bar-chart-label">{item.name}</span>
            <div className="bar-chart-bar-container">
              <div
                className="bar-chart-bar"
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              />
              <span className="bar-chart-value">{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    )
  } catch {
    return <p className="chart-error">Chart unavailable</p>
  }
}

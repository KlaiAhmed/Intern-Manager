interface MetricBarProps {
  label: string
  subtitle: string
  current: number
  maximum: number | null
  tone?: 'safe' | 'warning' | 'danger'
}

function sanitizeInteger(value: number | null): number | null {
  if (value === null || Number.isNaN(value)) {
    return null
  }

  if (value < 0) {
    return 0
  }

  return Math.round(value)
}

export function MetricBar({ label, subtitle, current, maximum, tone = 'safe' }: MetricBarProps) {
  const currentValue = sanitizeInteger(current) ?? 0
  const maxValue = sanitizeInteger(maximum)
  const progressMax = maxValue && maxValue > 0 ? maxValue : Math.max(currentValue, 1)

  return (
    <article className={`supervisor-metric-bar supervisor-metric-bar-${tone}`}>
      <header className="supervisor-metric-bar-header">
        <h3 className="supervisor-metric-bar-label">{label}</h3>
        <span className="supervisor-metric-bar-value">
          {currentValue}
          {maxValue !== null ? ` / ${maxValue}` : ''}
        </span>
      </header>

      <progress className="supervisor-metric-bar-progress" max={progressMax} value={currentValue} />

      <p className="supervisor-metric-bar-subtitle">{subtitle}</p>
    </article>
  )
}

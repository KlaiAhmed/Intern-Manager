import type { ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  change?: number
  changeLabel?: string
  icon?: ReactNode
  variant?: 'default' | 'positive' | 'negative' | 'neutral'
}

/**
 * StatCard — A metric card displaying a key value with optional trend indicator
 * Refined aesthetic: clean, spacious, understated
 */
export function StatCard({
  label,
  value,
  change,
  changeLabel,
  icon,
  variant = 'default',
}: StatCardProps) {
  const changeClass = change !== undefined
    ? change > 0 ? 'stat-card-change-positive' : change < 0 ? 'stat-card-change-negative' : 'stat-card-change-neutral'
    : null

  return (
    <article className={`stat-card stat-card-${variant}`}>
      <div className="stat-card-header">
        {icon && <span className="stat-card-icon" aria-hidden="true">{icon}</span>}
      </div>
      <div className="stat-card-content">
        <h3 className="stat-card-label">{label}</h3>
        <div className="stat-card-value">{value}</div>
        {change !== undefined && (
          <div className={`stat-card-change ${changeClass}`}>
            <span className="stat-card-change-value">
              {change > 0 ? '+' : ''}{change}%
            </span>
            {changeLabel && (
              <span className="stat-card-change-label">{changeLabel}</span>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

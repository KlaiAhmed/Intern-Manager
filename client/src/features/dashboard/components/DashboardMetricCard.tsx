import type { ReactNode } from 'react'

type DashboardMetricVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger'
type DashboardMetricHighlight = 'none' | 'success' | 'warning' | 'danger'

interface DashboardMetricCardProps {
  label: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  change?: number
  changeLabel?: string
  variant?: DashboardMetricVariant
  highlight?: DashboardMetricHighlight
  animationDelay?: number
}

const supportedAnimationDelays = new Set([0, 60, 120, 180, 240, 300, 360])

export function DashboardMetricCard({
  label,
  value,
  subtitle,
  icon,
  change,
  changeLabel,
  variant = 'default',
  highlight = 'none',
  animationDelay = 0,
}: DashboardMetricCardProps) {
  const normalizedDelay = supportedAnimationDelays.has(animationDelay) ? animationDelay : 0
  const animationDelayClass = normalizedDelay > 0 ? `super-admin-stat-card-delay-${normalizedDelay}` : ''
  const highlightClass = highlight !== 'none' ? `super-admin-stat-card-highlight-${highlight}` : ''

  const changeClass =
    change === undefined
      ? ''
      : change > 0
        ? 'super-admin-stat-change-positive'
        : change < 0
          ? 'super-admin-stat-change-negative'
          : 'super-admin-stat-change-neutral'

  const cardClassName = `super-admin-stat-card super-admin-stat-card-${variant} ${animationDelayClass} ${highlightClass}`.trim()
  const valueClassName = `super-admin-stat-value ${highlight !== 'none' ? `super-admin-stat-value-${highlight}` : ''}`.trim()

  return (
    <article className={cardClassName}>
      <div className="super-admin-stat-header">
        {icon && (
          <span className="super-admin-stat-icon" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <div className="super-admin-stat-content">
        <h3 className="super-admin-stat-label">{label}</h3>
        <div className={valueClassName}>{value}</div>
        {subtitle && <p className="super-admin-stat-subtitle">{subtitle}</p>}
        {change !== undefined && (
          <div className={`super-admin-stat-change ${changeClass}`.trim()}>
            <span className="super-admin-stat-change-value">
              {change > 0 ? '+' : ''}
              {change}%
            </span>
            {changeLabel && <span className="super-admin-stat-change-label">{changeLabel}</span>}
          </div>
        )}
      </div>
    </article>
  )
}

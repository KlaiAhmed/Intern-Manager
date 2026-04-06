import type { ReactNode } from 'react'

interface SuperAdminStatCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  change?: number
  changeLabel?: string
  variant?: 'default' | 'primary' | 'success' | 'warning'
  animationDelay?: number
}

/**
 * SuperAdminStatCard — Enhanced metric card for Super Admin dashboard
 * Follows the refined dashboard design system
 */
export function SuperAdminStatCard({
  label,
  value,
  icon,
  change,
  changeLabel,
  variant = 'default',
  animationDelay = 0,
}: SuperAdminStatCardProps) {
  const animationDelayClass = animationDelay > 0
    ? `super-admin-stat-card-delay-${animationDelay}`
    : ''

  const changeClass = change !== undefined
    ? change > 0
      ? 'super-admin-stat-change-positive'
      : change < 0
        ? 'super-admin-stat-change-negative'
        : 'super-admin-stat-change-neutral'
    : null

  return (
    <article
      className={`super-admin-stat-card super-admin-stat-card-${variant} ${animationDelayClass}`.trim()}
    >
      <div className="super-admin-stat-header">
        {icon && (
          <span className="super-admin-stat-icon" aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <div className="super-admin-stat-content">
        <h3 className="super-admin-stat-label">{label}</h3>
        <div className="super-admin-stat-value">{value}</div>
        {change !== undefined && (
          <div className={`super-admin-stat-change ${changeClass ?? ''}`}>
            <span className="super-admin-stat-change-value">
              {change > 0 ? '+' : ''}{change}%
            </span>
            {changeLabel && (
              <span className="super-admin-stat-change-label">{changeLabel}</span>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

import type { ReactNode } from 'react'
import { DashboardMetricCard } from './DashboardMetricCard'

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
  return (
    <DashboardMetricCard
      label={label}
      value={value}
      icon={icon}
      change={change}
      changeLabel={changeLabel}
      variant={variant}
      animationDelay={animationDelay}
    />
  )
}

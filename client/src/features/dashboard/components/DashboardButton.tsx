import type { ReactNode, ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md'

interface DashboardButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

/**
 * DashboardButton — Refined button with subtle micro-interactions
 * scale(0.98) on active press, no gratuitous effects
 */
export function DashboardButton({
  children,
  variant = 'secondary',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  ...props
}: DashboardButtonProps) {
  return (
    <button
      className={`dash-btn dash-btn-${variant} dash-btn-${size} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <span className="dash-btn-spinner" aria-hidden="true" />}
      <span className="dash-btn-text">{children}</span>
    </button>
  )
}

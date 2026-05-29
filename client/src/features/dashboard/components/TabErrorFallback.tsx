import { memo } from 'react'
import { DashboardButton } from './DashboardButton'

export interface TabErrorFallbackProps {
  title?: string
  message?: string
  retryLabel?: string
  onRetry: () => void
}

export const TabErrorFallback = memo(function TabErrorFallback({
  title = "We couldn't load this tab.",
  message = 'Try again, or switch tabs and come back.',
  retryLabel = 'Retry',
  onRetry,
}: TabErrorFallbackProps) {
  return (
    <div className="dash-error" role="alert">
      <div className="dash-error-icon" aria-hidden="true">
        !
      </div>
      <h2 className="dash-error-title">{title}</h2>
      <p className="dash-error-description">{message}</p>
      <DashboardButton variant="ghost" size="sm" onClick={onRetry}>
        {retryLabel}
      </DashboardButton>
    </div>
  )
})

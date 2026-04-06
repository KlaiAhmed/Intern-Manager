import { memo } from 'react'
import { DashboardButton } from './DashboardButton'

interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

/**
 * ErrorState — Clean error display with optional retry
 */
export const ErrorState = memo(function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="error-state" role="alert">
      <div className="error-icon" aria-hidden="true">!</div>
      <p className="error-message">{message}</p>
      {onRetry && (
        <DashboardButton variant="ghost" size="sm" onClick={onRetry}>
          Retry
        </DashboardButton>
      )}
    </div>
  )
})

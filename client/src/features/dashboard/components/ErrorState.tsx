import { DashboardButton } from './DashboardButton'
import './ErrorState.css'

interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

/**
 * ErrorState — Clean error display with optional retry
 */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
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
}

import { DashboardButton } from '../../components/DashboardButton'

interface InternTabLoadingProps {
  label: string
}

interface InternTabErrorProps {
  title: string
  message: string
  retryLabel: string
  onRetry?: () => void
}

interface InternTabEmptyProps {
  title: string
  message: string
}

export function InternTabLoading({ label }: InternTabLoadingProps) {
  return (
    <div className="intern-tab-state" role="status" aria-live="polite">
      <div className="intern-tab-spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  )
}

export function InternTabError({ title, message, retryLabel, onRetry }: InternTabErrorProps) {
  return (
    <div className="intern-tab-state intern-tab-state-error" role="alert">
      <h2>{title}</h2>
      <p>{message}</p>
      {onRetry && (
        <DashboardButton variant="secondary" size="sm" onClick={onRetry}>
          {retryLabel}
        </DashboardButton>
      )}
    </div>
  )
}

export function InternTabEmpty({ title, message }: InternTabEmptyProps) {
  return (
    <div className="intern-tab-state">
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  )
}

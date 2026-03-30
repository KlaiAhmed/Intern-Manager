import { useI18n } from '../../../shared/i18n/I18nContext'

interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

/**
 * Composant d'affichage d'erreur avec bouton de réessai.
 */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const { t } = useI18n()

  return (
    <div className="error-state" role="alert">
      <p className="error-message">{message}</p>
      {onRetry && (
        <button
          type="button"
          className="button button-secondary button-sm"
          onClick={onRetry}
        >
          {t('dashboard.error.retry')}
        </button>
      )}
    </div>
  )
}

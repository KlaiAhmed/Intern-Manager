import { StatusBadge } from './StatusBadge'
import type { SupervisorNotificationItem } from '../types/supervisorDashboard'

interface NotificationPanelProps {
  isOpen: boolean
  title: string
  notifications: SupervisorNotificationItem[]
  isLoading: boolean
  error: string | null
  loadingLabel: string
  emptyMessage: string
  retryLabel: string
  closeLabel: string
  readLabel: string
  unreadLabel: string
  resolveTypeLabel: (item: SupervisorNotificationItem) => string
  onClose: () => void
  onRetry: () => void
}

function formatTimestamp(value: string): string {
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsedDate)
}

export function NotificationPanel({
  isOpen,
  title,
  notifications,
  isLoading,
  error,
  loadingLabel,
  emptyMessage,
  retryLabel,
  closeLabel,
  readLabel,
  unreadLabel,
  resolveTypeLabel,
  onClose,
  onRetry,
}: NotificationPanelProps) {
  if (!isOpen) {
    return null
  }

  return (
    <aside className="supervisor-notification-panel" role="dialog" aria-label={title}>
      <header className="supervisor-notification-panel-header">
        <h2 className="supervisor-notification-panel-title">{title}</h2>
        <button type="button" className="supervisor-notification-panel-close" onClick={onClose}>
          {closeLabel}
        </button>
      </header>

      {isLoading ? (
        <div className="supervisor-notification-panel-state">{loadingLabel}</div>
      ) : error ? (
        <div className="supervisor-notification-panel-state">
          <p className="supervisor-notification-panel-error">{error}</p>
          <button type="button" className="dash-btn dash-btn-secondary dash-btn-sm" onClick={onRetry}>
            {retryLabel}
          </button>
        </div>
      ) : notifications.length === 0 ? (
        <p className="supervisor-notification-panel-state">{emptyMessage}</p>
      ) : (
        <ul className="supervisor-notification-list">
          {notifications.map((notification) => (
            <li key={notification.id} className="supervisor-notification-item">
              <div className="supervisor-notification-item-header">
                <p className="supervisor-notification-item-title">{notification.title}</p>
                <StatusBadge
                  label={notification.isRead ? readLabel : unreadLabel}
                  tone={notification.isRead ? 'neutral' : 'info'}
                  size="sm"
                />
              </div>
              <p className="supervisor-notification-item-type">{resolveTypeLabel(notification)}</p>
              <p className="supervisor-notification-item-message">{notification.message}</p>
              <time className="supervisor-notification-item-date" dateTime={notification.createdAt}>
                {formatTimestamp(notification.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

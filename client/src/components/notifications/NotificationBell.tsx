import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../shared/i18n/I18nContext'
import { classNames } from '../../shared/utils/classNames'
import { useNotifications } from '../../hooks/useNotifications'
import type { Notification } from '../../types/notification'

type NotificationBellProps = {
  role: string | null | undefined
  shouldClose?: boolean
}

const panelTransitionDurationMs = 200
const bellAttentionDurationMs = 620

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3.5a4.5 4.5 0 0 0-4.5 4.5v2.3c0 1.1-.4 2.1-1.1 2.9L5 14.8v1.2h14v-1.2l-1.4-1.6a4.3 4.3 0 0 1-1.1-2.9V8A4.5 4.5 0 0 0 12 3.5Z" />
      <path d="M9.5 18a2.5 2.5 0 0 0 5 0" />
    </svg>
  )
}

function MeetingIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M7.5 3.5v3M16.5 3.5v3M3.5 10h17" />
    </svg>
  )
}

function TaskIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M8 5.5h8" />
      <rect x="4" y="4" width="16" height="16" rx="2.5" />
      <path d="m8.5 12 2.1 2.1 4.9-4.9" />
    </svg>
  )
}

function MissionIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M3.5 6.5h17v11h-17z" />
      <path d="M9 6.5V5a3 3 0 0 1 6 0v1.5" />
    </svg>
  )
}

function StatusIcon() {
  return (
    <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 12.2 2.2 2.2 4.8-4.8" />
    </svg>
  )
}

function resolveNotificationIcon(notificationType: string) {
  const normalizedType = notificationType.toLowerCase()

  if (normalizedType.includes('meeting')) {
    return <MeetingIcon />
  }

  if (normalizedType.includes('task') || normalizedType.includes('deliverable')) {
    return <TaskIcon />
  }

  if (normalizedType.includes('mission')) {
    return <MissionIcon />
  }

  if (normalizedType.includes('status') || normalizedType.includes('profile') || normalizedType.includes('cv') || normalizedType.includes('evaluation')) {
    return <StatusIcon />
  }

  return <BellIcon />
}

function getRelativeUnit(secondsDifference: number): { value: number; unit: Intl.RelativeTimeFormatUnit } {
  const absoluteSeconds = Math.abs(secondsDifference)

  if (absoluteSeconds < 60) {
    return { value: secondsDifference, unit: 'second' }
  }

  const minutesDifference = Math.round(secondsDifference / 60)
  if (Math.abs(minutesDifference) < 60) {
    return { value: minutesDifference, unit: 'minute' }
  }

  const hoursDifference = Math.round(minutesDifference / 60)
  if (Math.abs(hoursDifference) < 24) {
    return { value: hoursDifference, unit: 'hour' }
  }

  const daysDifference = Math.round(hoursDifference / 24)
  if (Math.abs(daysDifference) < 7) {
    return { value: daysDifference, unit: 'day' }
  }

  const weeksDifference = Math.round(daysDifference / 7)
  if (Math.abs(weeksDifference) < 5) {
    return { value: weeksDifference, unit: 'week' }
  }

  const monthsDifference = Math.round(daysDifference / 30)
  if (Math.abs(monthsDifference) < 12) {
    return { value: monthsDifference, unit: 'month' }
  }

  return { value: Math.round(daysDifference / 365), unit: 'year' }
}

function getItemDelayStyle(index: number): CSSProperties {
  const delay = index < 5 ? index * 40 : 0
  return { '--notification-enter-delay': `${delay}ms` } as CSSProperties
}

export function NotificationBell({ role, shouldClose = false }: NotificationBellProps) {
  const { t, locale } = useI18n()
  const { notifications, unreadCount, markAllRead, markRead, isLoading } = useNotifications(role)

  const [isPanelRendered, setIsPanelRendered] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [isBellAnimating, setIsBellAnimating] = useState(false)

  const menuRef = useRef<HTMLDivElement | null>(null)
  const knownIdsRef = useRef<Set<string>>(new Set())
  const hasHydratedRef = useRef(false)
  const bellAnimationTimerRef = useRef<number | null>(null)

  const relativeTimeFormatter = useMemo(() => {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  }, [locale])

  const closePanel = () => {
    setIsPanelOpen(false)
  }

  const openPanel = () => {
    setIsPanelRendered(true)
    window.requestAnimationFrame(() => {
      setIsPanelOpen(true)
    })
  }

  const togglePanel = () => {
    if (isPanelOpen) {
      closePanel()
      return
    }

    setIsBellAnimating(false)
    openPanel()
  }

  const formatRelativeTimestamp = (rawDate: string): string => {
    const parsedDate = Date.parse(rawDate)

    if (Number.isNaN(parsedDate)) {
      return ''
    }

    const secondsDifference = Math.round((parsedDate - Date.now()) / 1000)
    const relativeUnit = getRelativeUnit(secondsDifference)

    return relativeTimeFormatter.format(relativeUnit.value, relativeUnit.unit)
  }

  useEffect(() => {
    if (!isPanelOpen && isPanelRendered) {
      const timerId = window.setTimeout(() => {
        setIsPanelRendered(false)
      }, panelTransitionDurationMs)

      return () => {
        window.clearTimeout(timerId)
      }
    }

    return undefined
  }, [isPanelOpen, isPanelRendered])

  useEffect(() => {
    if (shouldClose) {
      closePanel()
    }
  }, [shouldClose])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent): void => {
      if (!menuRef.current) {
        return
      }

      const target = event.target
      if (!(target instanceof Node)) {
        return
      }

      if (!menuRef.current.contains(target)) {
        closePanel()
      }
    }

    const onEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closePanel()
      }
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onEscape)

    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onEscape)
    }
  }, [])

  useEffect(() => {
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true
      knownIdsRef.current = new Set(notifications.map((notification) => notification.id))
      return
    }

    const previousIds = knownIdsRef.current
    const hasNewUnreadNotification = notifications.some((notification) => !notification.isRead && !previousIds.has(notification.id))

    knownIdsRef.current = new Set(notifications.map((notification) => notification.id))

    if (!hasNewUnreadNotification || isPanelOpen) {
      return
    }

    if (bellAnimationTimerRef.current !== null) {
      window.clearTimeout(bellAnimationTimerRef.current)
      bellAnimationTimerRef.current = null
    }

    setIsBellAnimating(false)
    window.requestAnimationFrame(() => {
      setIsBellAnimating(true)
    })

    bellAnimationTimerRef.current = window.setTimeout(() => {
      setIsBellAnimating(false)
      bellAnimationTimerRef.current = null
    }, bellAttentionDurationMs)
  }, [isPanelOpen, notifications])

  useEffect(() => {
    if (isPanelOpen) {
      setIsBellAnimating(false)
    }
  }, [isPanelOpen])

  useEffect(() => {
    return () => {
      if (bellAnimationTimerRef.current !== null) {
        window.clearTimeout(bellAnimationTimerRef.current)
      }
    }
  }, [])

  const handleMarkAllRead = async () => {
    await markAllRead()
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      await markRead(notification.id)
    }
  }

  const showBadge = unreadCount > 0
  const showCountBadge = unreadCount > 1
  const badgeLabel = unreadCount > 9 ? '9+' : unreadCount.toString()

  return (
    <div ref={menuRef} className={classNames('icon-control-dropdown', 'notification-dropdown', isPanelOpen && 'is-open')}>
      <button
        type="button"
        className={classNames('icon-control', 'notification-bell-trigger', isPanelOpen && 'active')}
        onClick={togglePanel}
        aria-label={t('notifications.aria.toggle')}
        title={t('notifications.aria.toggle')}
        aria-haspopup="menu"
        aria-expanded={isPanelOpen}
      >
        <span className={classNames('icon-control-mark', 'notification-bell-icon', isBellAnimating && 'is-attention')} aria-hidden="true">
          <BellIcon />
        </span>

        {showBadge ? (
          <span className={classNames('notification-dot', !showCountBadge && 'is-dot')} aria-hidden="true">
            {showCountBadge ? badgeLabel : null}
          </span>
        ) : null}
      </button>

      {isPanelRendered ? (
        <div className={classNames('notification-panel', isPanelOpen && 'is-open')} role="menu" aria-label={t('notifications.title')}>
          <div className="notification-panel-header">
            <h3 className="notification-panel-title">{t('notifications.title')}</h3>
            <button
              type="button"
              className="notification-panel-action"
              onClick={() => { void handleMarkAllRead() }}
              disabled={unreadCount === 0}
            >
              {t('notifications.markAllRead')}
            </button>
          </div>

          {isLoading ? (
            <div className="notification-panel-state notification-panel-loading" role="status">
              <div className="notification-panel-state-icon" aria-hidden="true">
                <BellIcon />
              </div>
              <p className="notification-panel-state-text">{t('notifications.loading')}</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="notification-panel-state notification-panel-empty" role="status">
              <div className="notification-panel-state-icon" aria-hidden="true">
                <BellIcon />
              </div>
              <p className="notification-panel-state-text">{t('notifications.empty')}</p>
            </div>
          ) : (
            <ul className="notification-list">
              {notifications.map((notification, index) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    className={classNames('notification-item', !notification.isRead && 'is-unread')}
                    style={getItemDelayStyle(index)}
                    onClick={() => { void handleNotificationClick(notification) }}
                  >
                    <span className={classNames('notification-item-unread-indicator', notification.isRead && 'is-hidden')} aria-hidden="true" />
                    <span className="notification-item-type-icon" aria-hidden="true">
                      {resolveNotificationIcon(notification.type)}
                    </span>

                    <span className="notification-item-content">
                      <span className="notification-item-title">{notification.title}</span>
                      <span className="notification-item-message">{notification.message}</span>
                      <span className="notification-item-meta">
                        <time className="notification-item-date" dateTime={notification.createdAt}>
                          {formatRelativeTimestamp(notification.createdAt)}
                        </time>
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="notification-panel-footer">
            <Link
              to="/dashboard"
              className="notification-panel-action"
              onClick={() => {
                closePanel()
              }}
            >
              {t('notifications.viewAll')}
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}

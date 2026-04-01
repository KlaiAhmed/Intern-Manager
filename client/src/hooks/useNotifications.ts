import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from '../shared/api/apiClient'
import { getCsrfCookieToken } from '../lib/auth'
import {
  normalizeDashboardNotificationRole,
  type DashboardNotificationRole,
  type Notification,
  type NotificationListResponse,
} from '../types/notification'

const notificationEndpointByRole: Record<DashboardNotificationRole, string> = {
  super_admin: '/api/notifications',
  admin: '/api/notifications',
  manager: '/api/notifications',
  supervisor: '/api/notifications',
  intern: '/api/notifications',
}

const pollingIntervalMs = 30_000
const defaultLimit = 20

interface UseNotificationsResult {
  notifications: Notification[]
  unreadCount: number
  markAllRead: () => Promise<void>
  markRead: (notificationId: string) => Promise<void>
  isLoading: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asBoolean(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false
}

function toNotification(value: unknown): Notification | null {
  if (!isRecord(value)) {
    return null
  }

  const id = asString(value.id)
  if (!id) {
    return null
  }

  return {
    id,
    type: asString(value.type),
    title: asString(value.title),
    message: asString(value.message),
    relatedEntity: asNullableString(value.relatedEntity),
    isRead: asBoolean(value.isRead),
    createdAt: asString(value.createdAt),
    readAt: asNullableString(value.readAt),
  }
}

function parseNotificationListResponse(payload: unknown): NotificationListResponse {
  if (!isRecord(payload)) {
    return {
      data: [],
      total: 0,
      page: 1,
      limit: defaultLimit,
    }
  }

  const data = Array.isArray(payload.data)
    ? payload.data
      .map(toNotification)
      .filter((notification): notification is Notification => notification !== null)
    : []

  const total = typeof payload.total === 'number' ? payload.total : data.length
  const page = typeof payload.page === 'number' ? payload.page : 1
  const limit = typeof payload.limit === 'number' ? payload.limit : defaultLimit

  return {
    data,
    total,
    page,
    limit,
  }
}

function buildHeaders(): Record<string, string> {
  const csrfToken = getCsrfCookieToken()

  if (!csrfToken) {
    return {}
  }

  return {
    'X-CSRF-Token': csrfToken,
  }
}

function buildMarkReadPath(id: string): string {
  return `/api/notifications/${encodeURIComponent(id)}/read`
}

export function useNotifications(role: string | null | undefined): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const isMountedRef = useRef(true)

  const normalizedRole = useMemo(() => normalizeDashboardNotificationRole(role), [role])

  const endpoint = useMemo(() => {
    if (!normalizedRole) {
      return null
    }

    return notificationEndpointByRole[normalizedRole]
  }, [normalizedRole])

  const fetchNotifications = useCallback(async () => {
    if (!endpoint) {
      if (isMountedRef.current) {
        setNotifications([])
        setIsLoading(false)
      }
      return
    }

    try {
      const response = await apiFetch(`${endpoint}?page=1&limit=${defaultLimit}`, {
        method: 'GET',
        headers: buildHeaders(),
      })

      if (!response.ok) {
        throw new Error(`Notifications request failed with status ${response.status}`)
      }

      const payload: unknown = await response.json()
      const parsed = parseNotificationListResponse(payload)

      if (isMountedRef.current) {
        setNotifications(parsed.data ?? [])
      }
    } catch {
      if (isMountedRef.current) {
        setNotifications([])
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [endpoint])

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    setIsLoading(true)
    void fetchNotifications()

    if (!endpoint) {
      return
    }

    const intervalId = window.setInterval(() => {
      void fetchNotifications()
    }, pollingIntervalMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [endpoint, fetchNotifications])

  const markRead = useCallback(async (notificationId: string) => {
    if (!endpoint || !notificationId.trim()) {
      return
    }

    const optimisticReadAt = new Date().toISOString()

    setNotifications((current) => current.map((notification) => {
      if (notification.id !== notificationId) {
        return notification
      }

      return {
        ...notification,
        isRead: true,
        readAt: notification.readAt ?? optimisticReadAt,
      }
    }))

    try {
      await apiFetch(buildMarkReadPath(notificationId), {
        method: 'PATCH',
        headers: buildHeaders(),
      })
    } catch {
      // Swallow errors: navbar notifications should never crash the UI.
    }
  }, [endpoint])

  const markAllRead = useCallback(async () => {
    if (!endpoint) {
      return
    }

    const unreadIds = notifications.filter((notification) => !notification.isRead).map((notification) => notification.id)

    if (unreadIds.length === 0) {
      return
    }

    const optimisticReadAt = new Date().toISOString()

    setNotifications((current) => current.map((notification) => {
      if (notification.isRead) {
        return notification
      }

      return {
        ...notification,
        isRead: true,
        readAt: notification.readAt ?? optimisticReadAt,
      }
    }))

    await Promise.all(unreadIds.map(async (id) => {
      try {
        await apiFetch(buildMarkReadPath(id), {
          method: 'PATCH',
          headers: buildHeaders(),
        })
      } catch {
        // Swallow per-item errors silently.
      }
    }))
  }, [endpoint, notifications])

  const unreadCount = useMemo(() => {
    return notifications.reduce((count, notification) => count + (notification.isRead ? 0 : 1), 0)
  }, [notifications])

  return {
    notifications,
    unreadCount,
    markAllRead,
    markRead,
    isLoading,
  }
}

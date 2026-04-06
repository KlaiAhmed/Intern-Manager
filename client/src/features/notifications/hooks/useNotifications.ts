import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchNotificationsByRole,
  markNotificationRead,
} from '../api/notificationsApi'
import {
  normalizeDashboardNotificationRole,
  type Notification,
} from '../types/notification'

const pollingIntervalMs = 30_000

interface UseNotificationsResult {
  notifications: Notification[]
  unreadCount: number
  markAllRead: () => Promise<void>
  markRead: (notificationId: string) => Promise<void>
  isLoading: boolean
}


export function useNotifications(role: string | null | undefined): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const isMountedRef = useRef(true)

  const normalizedRole = useMemo(() => normalizeDashboardNotificationRole(role), [role])

  const fetchNotifications = useCallback(async () => {
    if (!normalizedRole) {
      if (isMountedRef.current) {
        setNotifications([])
        setIsLoading(false)
      }
      return
    }

    try {
      const parsed = await fetchNotificationsByRole(normalizedRole)

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
  }, [normalizedRole])

  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    setIsLoading(true)
    void fetchNotifications()

    if (!normalizedRole) {
      return
    }

    const intervalId = window.setInterval(() => {
      void fetchNotifications()
    }, pollingIntervalMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [normalizedRole, fetchNotifications])

  const markRead = useCallback(async (notificationId: string) => {
    if (!normalizedRole || !notificationId.trim()) {
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
      await markNotificationRead(notificationId)
    } catch {
      // Swallow errors: navbar notifications should never crash the UI.
    }
  }, [normalizedRole])

  const markAllRead = useCallback(async () => {
    if (!normalizedRole) {
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
        await markNotificationRead(id)
      } catch {
        // Swallow per-item errors silently.
      }
    }))
  }, [normalizedRole, notifications])

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

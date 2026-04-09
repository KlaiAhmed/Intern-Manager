import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { useDashboardApi } from '../useDashboardApi'
import type { PagedResponse, SupervisorNotificationItem } from '../../types/supervisorDashboard'
import { toErrorMessage, toNumber, toStringValue } from './utils'

interface NotificationApiItem {
  id?: unknown
  type?: unknown
  title?: unknown
  message?: unknown
  relatedEntity?: unknown
  isRead?: unknown
  createdAt?: unknown
  readAt?: unknown
}

export function useNotifications() {
  const { t } = useI18n()
  const { get, patch } = useDashboardApi()

  const [items, setItems] = useState<SupervisorNotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPanelOpen, setIsPanelOpen] = useState(false)

  const refresh = useCallback(async (): Promise<SupervisorNotificationItem[]> => {
    setIsLoading(true)
    setError(null)

    try {
      const [listResponse, unreadResponse] = await Promise.all([
        get<PagedResponse<NotificationApiItem>>('/api/notifications?page=1&limit=40'),
        get<PagedResponse<NotificationApiItem>>('/api/notifications?unreadOnly=true&page=1&limit=1'),
      ])

      const mappedItems = (listResponse.data ?? [])
        .map((item) => ({
          id: toStringValue(item.id),
          type: toStringValue(item.type),
          title: toStringValue(item.title),
          message: toStringValue(item.message),
          relatedEntity: toStringValue(item.relatedEntity),
          isRead: Boolean(item.isRead),
          createdAt: toStringValue(item.createdAt),
          readAt: toStringValue(item.readAt) || null,
        }))
        .filter((item) => item.id.length > 0)

      setItems(mappedItems)
      setUnreadCount(Math.max(0, Math.round(toNumber(unreadResponse.total))))

      return mappedItems
    } catch (requestError) {
      setError(toErrorMessage(requestError, t('dashboard.error.load')))
      return []
    } finally {
      setIsLoading(false)
    }
  }, [get, t])

  const markNotificationRead = useCallback(
    async (notificationId: string) => {
      await patch(`/api/notifications/${notificationId}/read`, {})

      setItems((previousItems) =>
        previousItems.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                isRead: true,
                readAt: notification.readAt ?? new Date().toISOString(),
              }
            : notification
        )
      )

      setUnreadCount((previousCount) => (previousCount > 0 ? previousCount - 1 : 0))
    },
    [patch]
  )

  const markAllAsRead = useCallback(
    async (sourceItems?: SupervisorNotificationItem[]) => {
      const targetItems = sourceItems ?? items
      const unreadItems = targetItems.filter((notification) => !notification.isRead)

      if (unreadItems.length === 0) {
        setUnreadCount(0)
        return
      }

      await Promise.all(unreadItems.map((notification) => patch(`/api/notifications/${notification.id}/read`, {})))

      setItems((previousItems) =>
        previousItems.map((notification) => ({
          ...notification,
          isRead: true,
          readAt: notification.readAt ?? new Date().toISOString(),
        }))
      )
      setUnreadCount(0)
    },
    [items, patch]
  )

  const openPanel = useCallback(async () => {
    setIsPanelOpen(true)
    const latestItems = await refresh()
    await markAllAsRead(latestItems)
  }, [markAllAsRead, refresh])

  const closePanel = useCallback(() => {
    setIsPanelOpen(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refresh()
    }, 30000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [refresh])

  return {
    items,
    unreadCount,
    isLoading,
    error,
    isPanelOpen,
    refresh,
    openPanel,
    closePanel,
    markNotificationRead,
    markAllAsRead,
  }
}

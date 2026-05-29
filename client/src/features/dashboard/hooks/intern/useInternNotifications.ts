import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { internDashboardApi } from '../../api/internDashboardApi'
import { internDashboardQueryKeys } from './internDashboardQueryKeys'
import { internDashboardStaleTimeMs, type InternQueryHookOptions } from './internHookOptions'

interface InternNotificationsHookOptions extends InternQueryHookOptions {
  isRead?: boolean
  page?: number
  pageSize?: number
  refetchIntervalMs?: number | false
}

export function useInternNotifications(options: InternNotificationsHookOptions = {}) {
  const queryClient = useQueryClient()
  const enabled = options.enabled ?? true
  const page = options.page ?? 1
  const pageSize = options.pageSize ?? 20
  const isRead = options.isRead

  const notificationsQuery = useQuery({
    queryKey: [...internDashboardQueryKeys.notifications(), { isRead, page, pageSize }] as const,
    queryFn: () => internDashboardApi.getNotifications({ isRead, page, pageSize }),
    enabled,
    staleTime: internDashboardStaleTimeMs,
    refetchInterval: enabled ? options.refetchIntervalMs : false,
  })

  const markReadMutation = useMutation({
    mutationFn: internDashboardApi.markNotificationRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: internDashboardQueryKeys.notifications() })
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: internDashboardApi.markAllNotificationsRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: internDashboardQueryKeys.notifications() })
    },
  })

  return {
    notifications: notificationsQuery.data?.data ?? [],
    unreadCount: isRead === false ? notificationsQuery.data?.total ?? 0 : 0,
    total: notificationsQuery.data?.total ?? 0,
    notificationsQuery,
    markReadMutation,
    markAllReadMutation,
    markRead: markReadMutation.mutateAsync,
    markAllRead: markAllReadMutation.mutateAsync,
    isLoading: notificationsQuery.isLoading,
    isFetching: notificationsQuery.isFetching,
    error: notificationsQuery.error ?? markReadMutation.error ?? markAllReadMutation.error,
    refetch: notificationsQuery.refetch,
  }
}

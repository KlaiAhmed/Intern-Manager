import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { internDashboardApi } from '../../api/internDashboardApi'
import { internDashboardQueryKeys } from './internDashboardQueryKeys'
import { internDashboardStaleTimeMs, type InternQueryHookOptions } from './internHookOptions'

export function useInternTasks(options: InternQueryHookOptions = {}) {
  const queryClient = useQueryClient()
  const enabled = options.enabled ?? true

  const tasksQuery = useQuery({
    queryKey: internDashboardQueryKeys.tasks(),
    queryFn: () => internDashboardApi.getTasks({ page: 1, limit: 100 }),
    enabled,
    staleTime: internDashboardStaleTimeMs,
  })

  const completeTaskMutation = useMutation({
    mutationFn: internDashboardApi.completeTask,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: internDashboardQueryKeys.tasks() }),
        queryClient.invalidateQueries({ queryKey: internDashboardQueryKeys.deliverables() }),
      ])
    },
  })

  const syncTasksMutation = useMutation({
    mutationFn: internDashboardApi.syncTasks,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: internDashboardQueryKeys.tasks() })
    },
  })

  return {
    tasks: tasksQuery.data?.data ?? [],
    total: tasksQuery.data?.total ?? 0,
    tasksQuery,
    completeTaskMutation,
    syncTasksMutation,
    completeTask: completeTaskMutation.mutateAsync,
    syncTasks: syncTasksMutation.mutateAsync,
    isLoading: tasksQuery.isLoading,
    isFetching: tasksQuery.isFetching,
    error: tasksQuery.error ?? completeTaskMutation.error ?? syncTasksMutation.error,
    refetch: tasksQuery.refetch,
  }
}

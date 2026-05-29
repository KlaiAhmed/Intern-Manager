import { useQuery } from '@tanstack/react-query'

import { internDashboardApi } from '../../api/internDashboardApi'
import { internDashboardQueryKeys } from './internDashboardQueryKeys'
import { internDashboardStaleTimeMs, type InternQueryHookOptions } from './internHookOptions'

interface InternEvaluationsHookOptions extends InternQueryHookOptions {
  page?: number
  pageSize?: number
}

export function useInternEvaluations(options: InternEvaluationsHookOptions = {}) {
  const enabled = options.enabled ?? true
  const page = options.page ?? 1
  const pageSize = options.pageSize ?? 100

  const evaluationsQuery = useQuery({
    queryKey: [...internDashboardQueryKeys.evaluations(), { page, pageSize }] as const,
    queryFn: () => internDashboardApi.getEvaluations({ page, pageSize }),
    enabled,
    staleTime: internDashboardStaleTimeMs,
  })

  return {
    evaluations: evaluationsQuery.data?.data ?? [],
    total: evaluationsQuery.data?.total ?? 0,
    page: evaluationsQuery.data?.page ?? page,
    pageSize: evaluationsQuery.data?.pageSize ?? pageSize,
    evaluationsQuery,
    isLoading: evaluationsQuery.isLoading,
    isFetching: evaluationsQuery.isFetching,
    error: evaluationsQuery.error,
    refetch: evaluationsQuery.refetch,
  }
}

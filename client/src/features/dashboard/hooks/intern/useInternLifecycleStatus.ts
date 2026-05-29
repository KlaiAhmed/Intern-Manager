import { useQuery } from '@tanstack/react-query'

import { internDashboardApi } from '../../api/internDashboardApi'
import type { Guid } from '../../types/intern.types'
import { internDashboardQueryKeys } from './internDashboardQueryKeys'
import { internDashboardStaleTimeMs, type InternQueryHookOptions } from './internHookOptions'

export function useInternLifecycleStatus(
  internId: Guid | null | undefined,
  options: InternQueryHookOptions = {},
) {
  const enabled = (options.enabled ?? true) && Boolean(internId)

  return useQuery({
    queryKey: internDashboardQueryKeys.status(internId),
    queryFn: () => internDashboardApi.getInternStatus(internId ?? ''),
    enabled,
    staleTime: internDashboardStaleTimeMs,
  })
}

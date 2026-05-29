import { useQuery } from '@tanstack/react-query'

import { internDashboardApi } from '../../api/internDashboardApi'
import { internDashboardQueryKeys } from './internDashboardQueryKeys'
import { internDashboardStaleTimeMs, type InternQueryHookOptions } from './internHookOptions'

interface InternMeetingsHookOptions extends InternQueryHookOptions {
  page?: number
  limit?: number
  upcoming?: boolean
}

export function useInternMeetings(options: InternMeetingsHookOptions = {}) {
  const enabled = options.enabled ?? true
  const page = options.page ?? 1
  const limit = options.limit ?? 20
  const upcoming = options.upcoming ?? true

  const meetingsQuery = useQuery({
    queryKey: [...internDashboardQueryKeys.meetings(), { page, limit, upcoming }] as const,
    queryFn: () => internDashboardApi.getMeetings({ page, limit, upcoming }),
    enabled,
    staleTime: internDashboardStaleTimeMs,
  })

  const nextMeetingQuery = useQuery({
    queryKey: [...internDashboardQueryKeys.meetings(), 'next'] as const,
    queryFn: internDashboardApi.getNextMeeting,
    enabled,
    staleTime: internDashboardStaleTimeMs,
  })

  const countQuery = useQuery({
    queryKey: internDashboardQueryKeys.meetingsCount(),
    queryFn: internDashboardApi.getUpcomingMeetingsCount,
    enabled,
    staleTime: internDashboardStaleTimeMs,
  })

  return {
    meetings: meetingsQuery.data?.data ?? [],
    nextMeeting: nextMeetingQuery.data?.data?.[0] ?? null,
    upcomingCount: countQuery.data?.count ?? 0,
    meetingsQuery,
    nextMeetingQuery,
    countQuery,
    isLoading: meetingsQuery.isLoading || nextMeetingQuery.isLoading || countQuery.isLoading,
    isFetching: meetingsQuery.isFetching || nextMeetingQuery.isFetching || countQuery.isFetching,
    error: meetingsQuery.error ?? nextMeetingQuery.error ?? countQuery.error,
    refetch: async () => {
      await Promise.all([
        meetingsQuery.refetch(),
        nextMeetingQuery.refetch(),
        countQuery.refetch(),
      ])
    },
  }
}

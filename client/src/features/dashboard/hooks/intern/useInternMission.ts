import { useQuery } from '@tanstack/react-query'

import { internDashboardApi } from '../../api/internDashboardApi'
import type { Guid, InternMissionDocumentResponse } from '../../types/intern.types'
import { parseMissionCardConfig } from '../../types/missionFeatureFlags'
import { internDashboardQueryKeys } from './internDashboardQueryKeys'
import { internDashboardStaleTimeMs, type InternQueryHookOptions } from './internHookOptions'

export function useInternMission(options: InternQueryHookOptions = {}) {
  const enabled = options.enabled ?? true

  const summaryQuery = useQuery({
    queryKey: internDashboardQueryKeys.missionSummary(),
    queryFn: internDashboardApi.getMissionSummary,
    enabled,
    staleTime: internDashboardStaleTimeMs,
  })

  const historyQuery = useQuery({
    queryKey: internDashboardQueryKeys.missionHistory(),
    queryFn: internDashboardApi.getMissionHistory,
    enabled,
    staleTime: internDashboardStaleTimeMs,
  })

  const featureFlagsQuery = useInternMissionFeatureFlags(options)

  return {
    internship: summaryQuery.data ?? null,
    missions: historyQuery.data?.missions ?? [],
    featureFlags: featureFlagsQuery.flags,
    summaryQuery,
    historyQuery,
    featureFlagsQuery,
    isLoading: summaryQuery.isLoading || historyQuery.isLoading || featureFlagsQuery.isLoading,
    isFetching: summaryQuery.isFetching || historyQuery.isFetching || featureFlagsQuery.isFetching,
    error: summaryQuery.error ?? historyQuery.error ?? featureFlagsQuery.error,
    refetch: async () => {
      await Promise.all([
        summaryQuery.refetch(),
        historyQuery.refetch(),
        featureFlagsQuery.refetch(),
      ])
    },
  }
}

export function useInternMissionFeatureFlags(options: InternQueryHookOptions = {}) {
  const enabled = options.enabled ?? true
  const query = useQuery({
    queryKey: internDashboardQueryKeys.missionFeatureFlags(),
    queryFn: internDashboardApi.getMissionFeatureFlags,
    enabled,
    staleTime: internDashboardStaleTimeMs,
    refetchInterval: enabled ? internDashboardStaleTimeMs : false,
    select: (response) => parseMissionCardConfig(response.data) ?? null,
  })

  return {
    ...query,
    flags: enabled ? query.data ?? null : null,
  }
}

interface UseInternMissionDocumentsOptions {
  enabled?: boolean
}

export function useInternMissionDocuments(
  missionId: Guid | string | null | undefined,
  options: UseInternMissionDocumentsOptions = {},
) {
  const normalizedMissionId = (missionId ?? '').toString().trim()
  const externalEnabled = options.enabled ?? true
  const enabled = externalEnabled && normalizedMissionId.length > 0

  const query = useQuery<InternMissionDocumentResponse[]>({
    queryKey: internDashboardQueryKeys.missionDocuments(normalizedMissionId || null),
    queryFn: () => internDashboardApi.getMissionDocuments(normalizedMissionId),
    enabled,
    staleTime: internDashboardStaleTimeMs,
  })

  return {
    documents: enabled ? query.data ?? [] : [],
    isLoading: enabled ? query.isLoading : false,
    isFetching: enabled ? query.isFetching : false,
    error: enabled ? query.error ?? null : null,
    refetch: query.refetch,
  }
}

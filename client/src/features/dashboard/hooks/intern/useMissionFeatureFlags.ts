import { useMemo } from 'react'

import type { MissionCardConfig } from '../../types/missionFeatureFlags'
import { useInternMissionFeatureFlags } from './useInternMission'

interface UseMissionFeatureFlagsResult {
  flags: MissionCardConfig | null
  isLoading: boolean
  error: string | null
}

export function useMissionFeatureFlags(missionId: string | null | undefined): UseMissionFeatureFlagsResult {
  const normalizedMissionId = useMemo(() => missionId?.trim() ?? '', [missionId])
  const query = useInternMissionFeatureFlags({
    enabled: normalizedMissionId.length > 0,
  })

  const error = query.error instanceof Error && query.error.message.trim()
    ? query.error.message
    : query.error
      ? 'Unable to load mission feature flags.'
      : null

  return {
    flags: normalizedMissionId ? query.flags : null,
    isLoading: normalizedMissionId ? query.isLoading : false,
    error,
  }
}

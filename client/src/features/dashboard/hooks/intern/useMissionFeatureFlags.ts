import { useEffect, useMemo, useRef, useState } from 'react'
import { useDashboardApi } from '../useDashboardApi'
import {
  parseMissionCardConfig,
  type MissionCardConfig,
} from '../../types/missionFeatureFlags'

const pollingIntervalMs = 60_000
const MAX_CACHE_SIZE = 10

const missionFlagCache = new Map<string, MissionCardConfig | null>()

function getCachedConfig(missionId: string): MissionCardConfig | null | undefined {
  return missionFlagCache.get(missionId)
}

function setCachedConfig(missionId: string, config: MissionCardConfig | null): void {
  if (missionFlagCache.size >= MAX_CACHE_SIZE && !missionFlagCache.has(missionId)) {
    const firstKey = missionFlagCache.keys().next().value
    if (firstKey) missionFlagCache.delete(firstKey)
  }
  missionFlagCache.set(missionId, config)
}

interface UseMissionFeatureFlagsResult {
  flags: MissionCardConfig | null
  isLoading: boolean
  error: string | null
}

export function useMissionFeatureFlags(missionId: string | null | undefined): UseMissionFeatureFlagsResult {
  const api = useDashboardApi()
  const normalizedMissionId = useMemo(() => missionId?.trim() ?? '', [missionId])
  const previousFlagsRef = useRef<MissionCardConfig | null>(null)

  const [flags, setFlags] = useState<MissionCardConfig | null>(
    normalizedMissionId ? (getCachedConfig(normalizedMissionId) ?? null) : null,
  )
  const [isLoading, setIsLoading] = useState(Boolean(normalizedMissionId))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!normalizedMissionId) {
      setFlags(null)
      setError(null)
      setIsLoading(false)
      return
    }

    let isCancelled = false

    const readFlags = async () => {
      setError(null)

      try {
        const result = await api.get<{ data?: unknown }>('/api/intern/me/feature-flags')
        const parsed = parseMissionCardConfig(result.data ?? null)

        if (isCancelled) {
          return
        }

        if (previousFlagsRef.current === null || JSON.stringify(previousFlagsRef.current) !== JSON.stringify(parsed)) {
          setCachedConfig(normalizedMissionId, parsed)
          previousFlagsRef.current = parsed
          setFlags(parsed)
        }
      } catch (requestError) {
        if (isCancelled) {
          return
        }

        const message = requestError instanceof Error && requestError.message.trim().length > 0
          ? requestError.message
          : 'Unable to load mission feature flags.'

        setError(message)
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    setIsLoading(true)
    void readFlags()

    const intervalId = window.setInterval(() => {
      void readFlags()
    }, pollingIntervalMs)

    return () => {
      isCancelled = true
      window.clearInterval(intervalId)
    }
  }, [api, normalizedMissionId])

  return {
    flags,
    isLoading,
    error,
  }
}

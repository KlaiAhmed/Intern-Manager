import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { useDashboardApi } from '../useDashboardApi'
import type { MissionStatus, SupervisorMission } from '../../types/supervisorDashboard'
import type { PagedResponse } from '../../shared/types/operations'
import { toErrorMessage, toNumber, toStringValue } from './utils'

interface MissionApiItem {
  id?: unknown
  title?: unknown
  description?: unknown
  status?: unknown
  internId?: unknown
  supervisorId?: unknown
  coSupervisorId?: unknown
  coSupervisorCanReview?: unknown
  coSupervisorCanEval?: unknown
  tools?: unknown
  level?: unknown
  skills?: unknown
  rawProgress?: unknown
  startDate?: unknown
  endDate?: unknown
  createdAt?: unknown
  updatedAt?: unknown
  rowVersion?: unknown
}

const PAST_STATUSES: readonly MissionStatus[] = ['archived', 'cancelled']

function mapMission(item: MissionApiItem): SupervisorMission | null {
  const id = toStringValue(item.id)
  if (!id) {
    return null
  }

  const skills = Array.isArray(item.skills)
    ? item.skills.filter((skill): skill is string => typeof skill === 'string')
    : []

  const coSupervisorIdValue = toStringValue(item.coSupervisorId)
  const rowVersionRaw = toNumber(item.rowVersion, Number.NaN)

  return {
    id,
    title: toStringValue(item.title),
    description: toStringValue(item.description),
    status: (toStringValue(item.status, 'active') as MissionStatus),
    internId: toStringValue(item.internId),
    supervisorId: toStringValue(item.supervisorId),
    coSupervisorId: coSupervisorIdValue.length > 0 ? coSupervisorIdValue : null,
    coSupervisorCanReview: item.coSupervisorCanReview === true,
    coSupervisorCanEval: item.coSupervisorCanEval === true,
    tools: toStringValue(item.tools),
    level: toStringValue(item.level),
    skills,
    rawProgress: typeof item.rawProgress === 'number' && Number.isFinite(item.rawProgress)
      ? item.rawProgress
      : 0,
    startDate: toStringValue(item.startDate) || null,
    endDate: toStringValue(item.endDate) || null,
    createdAt: toStringValue(item.createdAt),
    updatedAt: toStringValue(item.updatedAt),
    ...(Number.isFinite(rowVersionRaw) ? { rowVersion: rowVersionRaw } : {}),
  }
}

function isPastStatus(status: MissionStatus): boolean {
  return PAST_STATUSES.includes(status)
}

export function useSupervisorMissions() {
  const { t } = useI18n()
  const { get } = useDashboardApi()

  const [missions, setMissions] = useState<SupervisorMission[]>([])
  const [pastMissions, setPastMissions] = useState<SupervisorMission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await get<PagedResponse<MissionApiItem>>('/api/missions?page=1&limit=200')
      const items = (response.data ?? [])
        .map((item) => mapMission(item))
        .filter((mission): mission is SupervisorMission => mission !== null)

      const active: SupervisorMission[] = []
      const past: SupervisorMission[] = []

      for (const mission of items) {
        if (isPastStatus(mission.status)) {
          past.push(mission)
        } else {
          active.push(mission)
        }
      }

      setMissions(active)
      setPastMissions(past)
    } catch (requestError) {
      setError(toErrorMessage(requestError, t('dashboard.error.load')))
    } finally {
      setIsLoading(false)
    }
  }, [get, t])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    missions,
    pastMissions,
    isLoading,
    error,
    refresh,
  }
}

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/locales/I18nContext'
import { useDashboardApi } from '@/features/dashboard/hooks/useDashboardApi'
import type {
  CreateDeliverableRequest,
  CreateTaskRequest,
  MissionCardConfig,
  SupervisorDeliverable,
  SupervisorMission,
  UpdateDeliverableRequest,
  UpdateMissionRequest,
  UpdateTaskRequest,
} from '@/features/dashboard/types/supervisorDashboard'
import { toErrorMessage } from '@/features/dashboard/hooks/supervisor/utils'

export interface MissionData {
  mission: SupervisorMission | null
  featureFlags: MissionCardConfig | null
  deliverables: SupervisorDeliverable[]
}

const initialMissionData: MissionData = {
  mission: null,
  featureFlags: null,
  deliverables: [],
}

export function useMissionData(missionId: string) {
  const { t } = useI18n()
  const { get, post, put, patch, del } = useDashboardApi()

  const [data, setData] = useState<MissionData>(initialMissionData)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!missionId) {
      setIsLoading(false)
      setData(initialMissionData)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [mission, featureFlags, deliverables] = await Promise.all([
        get<SupervisorMission>(`/api/missions/${missionId}`),
        get<MissionCardConfig>(`/api/missions/${missionId}/feature-flags`),
        get<SupervisorDeliverable[]>(`/api/deliverables/mission/${missionId}`),
      ])

      setData({ mission, featureFlags, deliverables })
    } catch (requestError) {
      setError(toErrorMessage(requestError, t('dashboard.error.load')))
    } finally {
      setIsLoading(false)
    }
  }, [get, t, missionId])

  const updateMission = useCallback(
    async (patchFields: Partial<UpdateMissionRequest>): Promise<void> => {
      await patch(`/api/missions/${missionId}`, patchFields)
      await refresh()
    },
    [patch, missionId, refresh],
  )

  const patchMissionStatus = useCallback(
    async (status: string): Promise<void> => {
      await patch(`/api/missions/${missionId}/status`, { Status: status })
      await refresh()
    },
    [patch, missionId, refresh],
  )

  const updateFeatureFlags = useCallback(
    async (config: MissionCardConfig): Promise<void> => {
      await put(`/api/missions/${missionId}/feature-flags`, config)
      await refresh()
    },
    [put, missionId, refresh],
  )

  const createDeliverable = useCallback(
    async (req: CreateDeliverableRequest): Promise<void> => {
      await post('/api/deliverables', req)
      await refresh()
    },
    [post, refresh],
  )

  const updateDeliverable = useCallback(
    async (id: string, req: UpdateDeliverableRequest): Promise<void> => {
      await put(`/api/deliverables/${id}`, req)
      await refresh()
    },
    [put, refresh],
  )

  // TODO: confirm DELETE /api/deliverables/{id} controller exists with backend
  const deleteDeliverable = useCallback(
    async (id: string): Promise<void> => {
      await del(`/api/deliverables/${id}`)
      await refresh()
    },
    [del, refresh],
  )

  const createTask = useCallback(
    async (req: CreateTaskRequest): Promise<void> => {
      await post('/api/tasks', req)
      await refresh()
    },
    [post, refresh],
  )

  const updateTask = useCallback(
    async (id: string, req: UpdateTaskRequest): Promise<void> => {
      await put(`/api/tasks/${id}`, req)
      await refresh()
    },
    [put, refresh],
  )

  const deleteTask = useCallback(
    async (id: string): Promise<void> => {
      await del(`/api/tasks/${id}`)
      await refresh()
    },
    [del, refresh],
  )

  useEffect(() => {
    void refresh()
    // missionId is the re-fetch trigger; refresh captures it via closure
    // and is intentionally excluded from this dep array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId])

  return {
    data,
    isLoading,
    error,
    refresh,
    updateMission,
    patchMissionStatus,
    updateFeatureFlags,
    createDeliverable,
    updateDeliverable,
    deleteDeliverable,
    createTask,
    updateTask,
    deleteTask,
  }
}

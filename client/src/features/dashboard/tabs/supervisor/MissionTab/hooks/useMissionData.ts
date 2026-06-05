import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/locales/I18nContext'
import { useDashboardApi } from '@/features/dashboard/hooks/useDashboardApi'
import type {
  CreateDeliverableRequest,
  CreateTaskRequest,
  MissionDocument,
  MissionStatus,
  SupervisorDeliverable,
  SupervisorMission,
  UpdateDeliverableRequest,
  UpdateTaskRequest,
} from '@/features/dashboard/types/supervisorDashboard'
import { toErrorMessage } from '@/features/dashboard/hooks/supervisor/utils'

export interface MissionData {
  mission: SupervisorMission | null
  deliverables: SupervisorDeliverable[]
  documents: MissionDocument[]
  documentsError: string | null
}

const initialMissionData: MissionData = {
  mission: null,
  deliverables: [],
  documents: [],
  documentsError: null,
}

/**
 * Data and mutation surface for the supervisor Mission Card tab.
 *
 * Scope after the read-only refactor:
 * - Mission detail           → `GET /api/missions/{missionId}`
 * - Deliverables for table   → `GET /api/deliverables/mission/{missionId}`
 *   (kept so the Deliverables and Tasks tables on this tab can create /
 *   update / delete without leaving the screen.)
 * - Documents (resources)    → `GET /api/missions/{missionId}/documents`
 *   (tolerated error so a failed resource fetch does not blank the screen.)
 * - Upload document          → `POST /api/missions/{missionId}/documents`
 *   (multipart with `File` for a file upload or `Url` for a link).
 *
 * Out of scope (moved to dedicated flows or removed):
 * - Feature flags editing    — the in-tab supervisor panel was removed; the
 *   Admin `MissionFeatureFlagsSection` remains the source of truth.
 * - Mission status edits     — the in-tab transition buttons (pause / resume
 *   / archive) were removed. Status is now read-only on this screen.
 */
export function useMissionData(missionId: string) {
  const { t } = useI18n()
  const { get, post, patch, del, postFormData } = useDashboardApi()

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
      const [missionResult, deliverablesResult, documentsResult] = await Promise.allSettled([
        get<SupervisorMission>(`/api/missions/${missionId}`),
        get<SupervisorDeliverable[]>(`/api/deliverables/mission/${missionId}`),
        get<MissionDocument[]>(`/api/missions/${missionId}/documents`),
      ])

      if (missionResult.status === 'rejected') {
        throw missionResult.reason
      }
      if (deliverablesResult.status === 'rejected') {
        throw deliverablesResult.reason
      }

      let documents: MissionDocument[] = []
      let documentsError: string | null = null
      if (documentsResult.status === 'fulfilled') {
        documents = documentsResult.value
      } else {
        documentsError = toErrorMessage(documentsResult.reason, t('dashboard.supervisor.mission.documentsLoadFailed'))
      }

      setData({
        mission: missionResult.value,
        deliverables: deliverablesResult.value,
        documents,
        documentsError,
      })
    } catch (requestError) {
      setError(toErrorMessage(requestError, t('dashboard.error.load')))
    } finally {
      setIsLoading(false)
    }
  }, [get, t, missionId])

  const createDeliverable = useCallback(
    async (req: CreateDeliverableRequest): Promise<void> => {
      await post('/api/deliverables', req)
      await refresh()
    },
    [post, refresh],
  )

  const updateDeliverable = useCallback(
    async (id: string, req: UpdateDeliverableRequest): Promise<void> => {
      await patch(`/api/deliverables/${id}`, req)
      await refresh()
    },
    [patch, refresh],
  )

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
      await patch(`/api/tasks/${id}`, req)
      await refresh()
    },
    [patch, refresh],
  )

  const deleteTask = useCallback(
    async (id: string): Promise<void> => {
      await del(`/api/tasks/${id}`)
      await refresh()
    },
    [del, refresh],
  )

  const uploadDocumentFile = useCallback(
    async (file: File): Promise<void> => {
      const formData = new FormData()
      formData.append('File', file)
      await postFormData<MissionDocument>(`/api/missions/${missionId}/documents`, formData)
      await refresh()
    },
    [missionId, postFormData, refresh],
  )

  const uploadDocumentUrl = useCallback(
    async (url: string): Promise<void> => {
      const formData = new FormData()
      formData.append('Url', url)
      await postFormData<MissionDocument>(`/api/missions/${missionId}/documents`, formData)
      await refresh()
    },
    [missionId, postFormData, refresh],
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
    createDeliverable,
    updateDeliverable,
    deleteDeliverable,
    createTask,
    updateTask,
    deleteTask,
    uploadDocumentFile,
    uploadDocumentUrl,
  }
}

export type { MissionStatus }

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/locales/I18nContext'
import { useDashboardApi, isDashboardApiError } from '@/features/dashboard/hooks/useDashboardApi'
import type {
  CreateDeliverableRequest,
  CreateTaskRequest,
  MissionCardConfig,
  MissionStatus,
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

/**
 * Step 1 wiring stub for mutations that the backend has not yet exposed.
 * Throwing immediately keeps the UI off of fake routes and surfaces a
 * deterministic error to the calling component's existing catch block.
 */
class NotImplementedOnBackendError extends Error {
  constructor(operation: string) {
    super(`${operation} is not yet supported by the API.`)
    this.name = 'NotImplementedOnBackendError'
  }
}

export { NotImplementedOnBackendError }

/**
 * Data and mutation surface for the supervisor Mission Card tab.
 *
 * Wiring map:
 * - Mission detail            → `GET /api/missions/{missionId}`
 * - Feature flags             → `GET /api/missions/{missionId}/feature-flags`
 *   The backend restricts this route to `SuperAdmin,Admin` today; supervisors
 *   get `403`. The hook tolerates this with `Promise.allSettled` so the rest
 *   of the tab keeps loading, and returns `null` for `featureFlags` instead.
 * - Deliverables for table    → `GET /api/deliverables/mission/{missionId}` (flat)
 * - Update mission metadata   → `PATCH /api/missions/{missionId}` (not PUT)
 * - Mission status transitions→ `POST /api/missions/{missionId}/{pause|resume|archive}`.
 *   No general status-set endpoint exists, so other transitions
 *   (draft→active, active→completed, paused→cancelled, completed→archived not
 *   covered by `/archive`) are flagged as Step 2 backend gaps.
 * - Update feature flags      → `PUT /api/missions/{missionId}/feature-flags`
 * - Create deliverable        → `POST /api/deliverables` (requires `InternId`)
 * - Update deliverable        → Step 2 (no PUT/PATCH route on the backend)
 * - Delete deliverable        → `DELETE /api/deliverables/{id}`
 * - Create task               → `POST /api/tasks`
 * - Update task               → Step 2 (no PUT/PATCH route on the backend)
 * - Delete task               → Step 2 (no DELETE route on the backend)
 */
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
      const [missionResult, featureFlagsResult, deliverablesResult] = await Promise.allSettled([
        get<SupervisorMission>(`/api/missions/${missionId}`),
        get<MissionCardConfig>(`/api/missions/${missionId}/feature-flags`),
        get<SupervisorDeliverable[]>(`/api/deliverables/mission/${missionId}`),
      ])

      // Mission detail and deliverable list are critical. Surface their errors.
      if (missionResult.status === 'rejected') {
        throw missionResult.reason
      }
      if (deliverablesResult.status === 'rejected') {
        throw deliverablesResult.reason
      }

      // Feature flags are advisory. Treat the 403 returned for supervisors as
      // "panel hidden" rather than a tab-level error. Any unexpected failure
      // surfaces in the next refresh via the same advisory path.
      let featureFlags: MissionCardConfig | null = null
      if (featureFlagsResult.status === 'fulfilled') {
        featureFlags = featureFlagsResult.value
      } else if (
        !isDashboardApiError(featureFlagsResult.reason) ||
        featureFlagsResult.reason.status !== 403
      ) {
        console.warn(
          '[useMissionData] feature-flags fetch failed, panel will render hidden:',
          featureFlagsResult.reason,
        )
      }

      setData({
        mission: missionResult.value,
        featureFlags,
        deliverables: deliverablesResult.value,
      })
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
    async (status: MissionStatus): Promise<void> => {
      // Backend exposes dedicated POST endpoints for the three transitions it
      // supports today. PATCH /api/missions/{id} silently ignores `Status`.
      // Any other transition (draft→active, active→completed, paused→cancelled)
      // has no backend route yet — surface a clear error instead of pretending.
      const action =
        status === 'paused' ? 'pause' :
        status === 'active' ? 'resume' :
        status === 'archived' ? 'archive' :
        null

      if (action === null) {
        throw new NotImplementedOnBackendError(`Mission status transition to "${status}"`)
      }

      await post(`/api/missions/${missionId}/${action}`, {})
      await refresh()
    },
    [post, missionId, refresh],
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

  // Step 2: backend has no `PUT /api/deliverables/{id}` route. Throwing here
  // keeps the call signature for future wiring while preventing 404s.
  const updateDeliverable = useCallback(
    async (_id: string, _req: UpdateDeliverableRequest): Promise<void> => {
      void _id
      void _req
      throw new NotImplementedOnBackendError('Updating a deliverable')
    },
    [],
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

  // Step 2: backend has no `PUT /api/tasks/{id}` route.
  const updateTask = useCallback(
    async (_id: string, _req: UpdateTaskRequest): Promise<void> => {
      void _id
      void _req
      throw new NotImplementedOnBackendError('Updating a task')
    },
    [],
  )

  // Step 2: backend has no `DELETE /api/tasks/{id}` route.
  const deleteTask = useCallback(
    async (_id: string): Promise<void> => {
      void _id
      throw new NotImplementedOnBackendError('Deleting a task')
    },
    [],
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

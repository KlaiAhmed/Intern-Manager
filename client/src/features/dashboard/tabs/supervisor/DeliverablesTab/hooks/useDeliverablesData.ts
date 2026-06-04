import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/locales/I18nContext'
import { isDashboardApiError, useDashboardApi } from '@/features/dashboard/hooks/useDashboardApi'
import type {
  RejectDeliverableRequest,
  SupervisorDeliverable,
  SupervisorIntern,
} from '@/features/dashboard/types/supervisorDashboard'
import { toErrorMessage, toNumber, toStringValue } from '@/features/dashboard/hooks/supervisor/utils'

class ConflictError extends Error {
  isConflict = true as const
  constructor() {
    super('Conflict: item was modified concurrently')
  }
}

export { ConflictError }

export interface DeliverablesData {
  deliverables: SupervisorDeliverable[]
  interns: SupervisorIntern[]
}

const initialDeliverablesData: DeliverablesData = {
  deliverables: [],
  interns: [],
}

interface SupervisorInternRow {
  id?: unknown
  name?: unknown
  fullName?: unknown
  firstName?: unknown
  lastName?: unknown
  email?: unknown
  missionTitle?: unknown
  startDate?: unknown
  endDate?: unknown
  status?: unknown
  verificationStatus?: unknown
  progress?: unknown
  lastJournalDate?: unknown
  isOverdue?: unknown
}

function readListItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }
  if (payload && typeof payload === 'object') {
    const data = (payload as { data?: unknown }).data
    if (Array.isArray(data)) {
      return data
    }
  }
  return []
}

function mapSupervisorIntern(item: unknown): SupervisorIntern | null {
  if (!item || typeof item !== 'object') {
    return null
  }
  const raw = item as SupervisorInternRow
  const id = toStringValue(raw.id)
  if (!id) {
    return null
  }
  const firstName = toStringValue(raw.firstName)
  const lastName = toStringValue(raw.lastName)
  const composedName = `${firstName} ${lastName}`.trim()
  const fullName = toStringValue(raw.fullName) || toStringValue(raw.name) || composedName
  const progressRaw = toNumber(raw.progress, Number.NaN)
  return {
    id,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    fullName,
    email: toStringValue(raw.email) || undefined,
    missionTitle: toStringValue(raw.missionTitle) || undefined,
    startDate: toStringValue(raw.startDate) || null,
    endDate: toStringValue(raw.endDate) || null,
    status: toStringValue(raw.status) || undefined,
    verificationStatus: toStringValue(raw.verificationStatus) || undefined,
    progressPercent: Number.isFinite(progressRaw)
      ? Math.max(0, Math.min(100, Math.round(progressRaw)))
      : undefined,
    lastJournalDate: toStringValue(raw.lastJournalDate) || null,
    isOverdue: raw.isOverdue === true,
  }
}

/**
 * Data and review actions for the supervisor Deliverables tab.
 *
 * Wiring map:
 * - Deliverables list → `GET /api/deliverables/mission/{missionId}` (flat array
 *   of `DeliverableQueueItemResponse` including embedded `tasks`).
 * - Intern roster     → `GET /api/supervisor/me/interns` (paged, supervisor-scoped).
 * - Approve           → `POST /api/deliverables/{id}/approve` with `{ RowVersion }`
 *   where `RowVersion` is the numeric concurrency token. The previous code used
 *   `PUT` against the same path, which the backend does not expose.
 * - Reject            → `POST /api/deliverables/{id}/reject` with
 *   `{ Reason, TaskIdsToReopen, RowVersion }`. Same `PUT→POST` correction.
 *
 * Conflict handling: any `409 Conflict` (returned by the backend on stale
 * `RowVersion`) re-throws a typed `ConflictError`. Components inspect this
 * to show the concurrent-edit toast without auto-refreshing the drawer.
 */
export function useDeliverablesData(missionId: string) {
  const { t } = useI18n()
  const { get, post } = useDashboardApi()

  const [data, setData] = useState<DeliverablesData>(initialDeliverablesData)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!missionId) {
      setIsLoading(false)
      setData(initialDeliverablesData)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [deliverables, internsResponse] = await Promise.all([
        get<SupervisorDeliverable[]>(`/api/deliverables/mission/${missionId}`),
        get<unknown>('/api/supervisor/me/interns'),
      ])

      const interns = readListItems(internsResponse)
        .map((item) => mapSupervisorIntern(item))
        .filter((intern): intern is SupervisorIntern => intern !== null)

      setData({ deliverables, interns })
    } catch (requestError) {
      setError(toErrorMessage(requestError, t('dashboard.error.load')))
    } finally {
      setIsLoading(false)
    }
  }, [get, t, missionId])

  const approveDeliverable = useCallback(
    async (id: string, rowVersion: number): Promise<void> => {
      try {
        await post(`/api/deliverables/${id}/approve`, { RowVersion: rowVersion })
        await refresh()
      } catch (requestError) {
        if (isDashboardApiError(requestError) && requestError.status === 409) {
          throw new ConflictError()
        }
        throw requestError
      }
    },
    [post, refresh],
  )

  const rejectDeliverable = useCallback(
    async (id: string, req: RejectDeliverableRequest): Promise<void> => {
      try {
        await post(`/api/deliverables/${id}/reject`, req)
        await refresh()
      } catch (requestError) {
        if (isDashboardApiError(requestError) && requestError.status === 409) {
          throw new ConflictError()
        }
        throw requestError
      }
    },
    [post, refresh],
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
    approveDeliverable,
    rejectDeliverable,
  }
}

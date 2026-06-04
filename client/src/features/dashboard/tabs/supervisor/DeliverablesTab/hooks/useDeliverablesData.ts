import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/locales/I18nContext'
import { isDashboardApiError, useDashboardApi } from '@/features/dashboard/hooks/useDashboardApi'
import type {
  RejectDeliverableRequest,
  SupervisorDeliverable,
  SupervisorIntern,
} from '@/features/dashboard/types/supervisorDashboard'
import { toErrorMessage } from '@/features/dashboard/hooks/supervisor/utils'

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

export function useDeliverablesData(missionId: string) {
  const { t } = useI18n()
  const { get, put } = useDashboardApi()

  const [data, setData] = useState<DeliverablesData>(initialDeliverablesData)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // useDashboardApi() throws a DashboardApiError on every non-2xx response.
  // The thrown error exposes a numeric .status property, so a 409 (concurrent
  // modification) is detected via `isDashboardApiError(err) && err.status === 409`.
  // On 409 the approve/reject mutations below re-throw a typed ConflictError so
  // callers can identify the conflict with `err instanceof ConflictError` and
  // decide whether to refresh, re-read rowVersion, or surface a drawer error.
  const refresh = useCallback(async () => {
    if (!missionId) {
      setIsLoading(false)
      setData(initialDeliverablesData)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [deliverables, interns] = await Promise.all([
        get<SupervisorDeliverable[]>(`/api/deliverables/mission/${missionId}`),
        get<SupervisorIntern[]>('/api/supervisor/interns'),
      ])

      setData({ deliverables, interns })
    } catch (requestError) {
      setError(toErrorMessage(requestError, t('dashboard.error.load')))
    } finally {
      setIsLoading(false)
    }
  }, [get, t, missionId])

  const approveDeliverable = useCallback(
    async (id: string, rowVersion: string): Promise<void> => {
      try {
        await put(`/api/deliverables/${id}/approve`, { RowVersion: rowVersion })
        await refresh()
      } catch (requestError) {
        if (isDashboardApiError(requestError) && requestError.status === 409) {
          throw new ConflictError()
        }
        throw requestError
      }
    },
    [put, refresh],
  )

  const rejectDeliverable = useCallback(
    async (id: string, req: RejectDeliverableRequest): Promise<void> => {
      try {
        await put(`/api/deliverables/${id}/reject`, req)
        await refresh()
      } catch (requestError) {
        if (isDashboardApiError(requestError) && requestError.status === 409) {
          throw new ConflictError()
        }
        throw requestError
      }
    },
    [put, refresh],
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

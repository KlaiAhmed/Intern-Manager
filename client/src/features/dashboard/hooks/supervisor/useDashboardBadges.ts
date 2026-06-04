import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { useDashboardApi } from '../useDashboardApi'
import { toErrorMessage, toNumber } from './utils'

interface CountResponse {
  count?: unknown
}

function formatTodayIsoDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function readCount(payload: unknown): number {
  if (!payload || typeof payload !== 'object') {
    return 0
  }
  const raw = (payload as CountResponse).count
  return Math.max(0, Math.round(toNumber(raw, 0)))
}

/**
 * Tab navigation badge counts for the supervisor dashboard shell.
 *
 * Wiring map:
 * - Pending deliverable reviews → `GET /api/stats/supervisor/me/deliverables/pending` → `{ count }`
 * - Today's meetings            → `GET /api/meetings?from={today}&to={today}&count=true` → `{ count }`
 * - Overdue tasks (intern-level)→ `GET /api/stats/supervisor/me/overdue` → `{ count }`
 *
 * The pending-review and overdue endpoints are scoped to the authenticated
 * supervisor on the backend, so no mission-scope query parameter is required.
 * The `missionId` argument is still honoured as a refresh trigger so the shell
 * re-fetches whenever the active mission changes.
 */
export function useDashboardBadges(missionId: string | null) {
  const { t } = useI18n()
  const { get } = useDashboardApi()

  const [pendingReviewCount, setPendingReviewCount] = useState(0)
  const [todayMeetingCount, setTodayMeetingCount] = useState(0)
  const [overdueTaskCount, setOverdueTaskCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!missionId) {
      return
    }

    setIsLoading(true)
    setError(null)

    const todayIso = formatTodayIsoDate()

    try {
      const [pendingResult, meetingsResult, overdueResult] = await Promise.all([
        get<CountResponse>('/api/stats/supervisor/me/deliverables/pending'),
        get<CountResponse>(`/api/meetings?from=${todayIso}&to=${todayIso}&count=true`),
        get<CountResponse>('/api/stats/supervisor/me/overdue'),
      ])

      setPendingReviewCount(readCount(pendingResult))
      setTodayMeetingCount(readCount(meetingsResult))
      setOverdueTaskCount(readCount(overdueResult))
    } catch (requestError) {
      setError(toErrorMessage(requestError, t('dashboard.error.load')))
    } finally {
      setIsLoading(false)
    }
  }, [get, missionId, t])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    pendingReviewCount,
    todayMeetingCount,
    overdueTaskCount,
    isLoading,
    error,
    refresh,
  }
}

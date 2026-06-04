import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { useDashboardApi } from '../useDashboardApi'
import { toErrorMessage } from './utils'

function formatTodayIsoDate(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toArrayLength(value: unknown): number {
  return Array.isArray(value) ? value.length : 0
}

export function useDashboardBadges(missionId: string | null) {
  const { t } = useI18n()
  const { get } = useDashboardApi()

  const [pendingReviewCount, setPendingReviewCount] = useState(0)
  const [todayMeetingCount, setTodayMeetingCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // TODO: wire to useTasksData overdueCount once Wave 3D lands.
  const overdueTaskCount = 0

  const refresh = useCallback(async () => {
    if (!missionId) {
      return
    }

    setIsLoading(true)
    setError(null)

    const todayIso = formatTodayIsoDate()

    try {
      const [queueResult, meetingsResult] = await Promise.all([
        get<unknown[]>(`/api/deliverables/queue?status=awaiting_review`),
        get<unknown[]>(`/api/meetings?from=${todayIso}&to=${todayIso}`),
      ])

      setPendingReviewCount(toArrayLength(queueResult))
      setTodayMeetingCount(toArrayLength(meetingsResult))
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

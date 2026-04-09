import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { useDashboardApi } from '../useDashboardApi'
import type { SupervisorInternProgressItem } from '../../types/supervisorDashboard'
import { clampProgress, toErrorMessage, toStringValue } from './utils'

interface InternProgressApiItem {
  internId?: unknown
  fullName?: unknown
  missionTitle?: unknown
  stageType?: unknown
  progress?: unknown
  status?: unknown
  isLate?: unknown
}

interface InternProgressApiResponse {
  data?: InternProgressApiItem[]
}

export function useInternProgress() {
  const { t } = useI18n()
  const { get } = useDashboardApi()

  const [items, setItems] = useState<SupervisorInternProgressItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await get<InternProgressApiResponse>('/api/supervisor/me/interns/progress')
      const mappedItems = (response.data ?? []).map((item) => {
        const parsedProgress = Number(item.progress ?? 0)
        return {
          internId: toStringValue(item.internId),
          fullName: toStringValue(item.fullName),
          missionTitle: toStringValue(item.missionTitle),
          stageType: toStringValue(item.stageType, 'N/A'),
          progress: clampProgress(Number.isFinite(parsedProgress) ? parsedProgress : 0),
          status: toStringValue(item.status, 'ON_TRACK').toUpperCase(),
          isLate: Boolean(item.isLate),
        }
      })

      setItems(mappedItems.filter((item) => item.internId.length > 0))
    } catch (requestError) {
      setError(toErrorMessage(requestError, t('dashboard.error.load')))
    } finally {
      setIsLoading(false)
    }
  }, [get, t])

  useEffect(() => {
    void refresh()
    const pollId = window.setInterval(() => {
      void refresh()
    }, 45000)

    return () => {
      window.clearInterval(pollId)
    }
  }, [refresh])

  return {
    items,
    isLoading,
    error,
    refresh,
  }
}

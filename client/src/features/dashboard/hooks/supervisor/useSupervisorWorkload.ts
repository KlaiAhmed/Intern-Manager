import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { useDashboardApi } from '../useDashboardApi'
import type { SupervisorWorkload } from '../../types/supervisorDashboard'
import { toErrorMessage, toNumber } from './utils'

interface SupervisorWorkloadResponse {
  currentInternCount?: unknown
  maxCapacity?: unknown
  utilizationPercent?: unknown
  pfeCount?: unknown
  summerCount?: unknown
  otherCount?: unknown
}

const initialWorkload: SupervisorWorkload = {
  currentInternCount: 0,
  maxCapacity: null,
  utilizationPercent: null,
  pfeCount: 0,
  summerCount: 0,
  otherCount: 0,
}

export function useSupervisorWorkload() {
  const { t } = useI18n()
  const { get } = useDashboardApi()

  const [workload, setWorkload] = useState<SupervisorWorkload>(initialWorkload)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await get<SupervisorWorkloadResponse>('/api/stats/supervisor/me/workload')

      const maxCapacityRaw = toNumber(response.maxCapacity, Number.NaN)
      const utilizationRaw = toNumber(response.utilizationPercent, Number.NaN)

      setWorkload({
        currentInternCount: Math.max(0, Math.round(toNumber(response.currentInternCount))),
        maxCapacity: Number.isFinite(maxCapacityRaw) ? Math.max(0, Math.round(maxCapacityRaw)) : null,
        utilizationPercent: Number.isFinite(utilizationRaw) ? Math.max(0, Math.round(utilizationRaw)) : null,
        pfeCount: Math.max(0, Math.round(toNumber(response.pfeCount))),
        summerCount: Math.max(0, Math.round(toNumber(response.summerCount))),
        otherCount: Math.max(0, Math.round(toNumber(response.otherCount))),
      })
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
    workload,
    isLoading,
    error,
    refresh,
  }
}

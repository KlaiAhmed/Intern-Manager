import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { useDashboardApi } from '../useDashboardApi'
import type { SupervisorKpis } from '../../types/supervisorDashboard'
import { toErrorMessage, toNumber } from './utils'

interface CountResponse {
  count?: unknown
}

interface AvgValidationDelayResponse {
  days?: unknown
  sampleSize?: unknown
}

const initialKpis: SupervisorKpis = {
  activeInterns: 0,
  pendingDeliverables: 0,
  internsBehind: 0,
  avgValidationDelayDays: 0,
  validationDelaySampleSize: 0,
}

export function useSupervisorKpis() {
  const { t } = useI18n()
  const { get } = useDashboardApi()

  const [kpis, setKpis] = useState<SupervisorKpis>(initialKpis)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [activeInterns, pendingDeliverables, internsBehind, avgValidationDelay] = await Promise.all([
        get<CountResponse>('/api/stats/supervisor/me/interns/active'),
        get<CountResponse>('/api/stats/supervisor/me/deliverables/pending'),
        get<CountResponse>('/api/stats/supervisor/me/overdue'),
        get<AvgValidationDelayResponse>('/api/stats/supervisor/me/avg-validation-delay'),
      ])

      setKpis({
        activeInterns: Math.max(0, Math.round(toNumber(activeInterns.count))),
        pendingDeliverables: Math.max(0, Math.round(toNumber(pendingDeliverables.count))),
        internsBehind: Math.max(0, Math.round(toNumber(internsBehind.count))),
        avgValidationDelayDays: Math.max(0, Number(toNumber(avgValidationDelay.days).toFixed(1))),
        validationDelaySampleSize: Math.max(0, Math.round(toNumber(avgValidationDelay.sampleSize))),
      })
    } catch (requestError) {
      setError(toErrorMessage(requestError, t('dashboard.error.load')))
    } finally {
      setIsLoading(false)
    }
  }, [get, t])

  const applyPendingDelta = useCallback((delta: number) => {
    setKpis((previous) => {
      const nextValue = previous.pendingDeliverables + Math.trunc(delta)
      return {
        ...previous,
        pendingDeliverables: nextValue > 0 ? nextValue : 0,
      }
    })
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    kpis,
    isLoading,
    error,
    refresh,
    applyPendingDelta,
  }
}

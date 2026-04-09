import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { useDashboardApi } from '../useDashboardApi'
import type { SupervisorDelayAlertItem } from '../../types/supervisorDashboard'
import { toErrorMessage, toNumber, toStringValue } from './utils'

interface DelayAlertApiItem {
  internId?: unknown
  internName?: unknown
  deliverableId?: unknown
  deliverableTitle?: unknown
  dueDate?: unknown
  daysOverdue?: unknown
  severity?: unknown
}

interface DelayAlertsApiResponse {
  data?: DelayAlertApiItem[]
  total?: unknown
}

export function useDelaysAlerts() {
  const { t } = useI18n()
  const { get } = useDashboardApi()

  const [alerts, setAlerts] = useState<SupervisorDelayAlertItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await get<DelayAlertsApiResponse>('/api/stats/supervisor/me/delays-alerts')
      const mappedAlerts = (response.data ?? [])
        .map((item) => ({
          internId: toStringValue(item.internId),
          internName: toStringValue(item.internName),
          deliverableId: toStringValue(item.deliverableId),
          deliverableTitle: toStringValue(item.deliverableTitle),
          dueDate: toStringValue(item.dueDate),
          daysOverdue: Math.max(0, Math.round(toNumber(item.daysOverdue))),
          severity: toStringValue(item.severity, 'MODERATE').toUpperCase(),
        }))
        .filter((item) => item.deliverableId.length > 0)
        .sort((left, right) => right.daysOverdue - left.daysOverdue)

      setAlerts(mappedAlerts)
      setTotal(Math.max(mappedAlerts.length, Math.round(toNumber(response.total))))
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
    alerts,
    total,
    isLoading,
    error,
    refresh,
  }
}

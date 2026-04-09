import { useCallback, useEffect, useState } from 'react'
import { useDashboardApi } from '../../hooks/useDashboardApi'
import type { AdminOverviewStats, CountResponse } from '../types/operations'
import { readCount } from '../utils/operations'
import { toDashboardErrorMessage } from '../utils/errorMessage'

interface UseAdminOverviewStatsResult {
  stats: AdminOverviewStats
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const initialStats: AdminOverviewStats = {
  totalInterns: 0,
  activeInternships: 0,
  totalSupervisors: 0,
  pendingDeliverables: 0,
}

export function useAdminOverviewStats(): UseAdminOverviewStatsResult {
  const api = useDashboardApi()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<AdminOverviewStats>(initialStats)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [internsCount, internshipsCount, supervisorsCount, deliverablesCount] = await Promise.all([
        api.get<CountResponse>('/api/stats/interns/count'),
        api.get<CountResponse>('/api/stats/internships/active'),
        api.get<CountResponse>('/api/stats/supervisors/count'),
        api.get<CountResponse>('/api/stats/deliverables/pending'),
      ])

      setStats({
        totalInterns: readCount(internsCount),
        activeInternships: readCount(internshipsCount),
        totalSupervisors: readCount(supervisorsCount),
        pendingDeliverables: readCount(deliverablesCount),
      })
    } catch (requestError) {
      setError(toDashboardErrorMessage(requestError))
      setStats(initialStats)
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    stats,
    loading,
    error,
    refresh,
  }
}

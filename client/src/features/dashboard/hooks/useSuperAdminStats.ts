import { useState, useEffect, useCallback } from 'react'
import { useDashboardApi } from './useDashboardApi'

interface KPIStats {
  activeInterns: number | null
  activeSupervisors: number | null
  totalMissions: number | null
  activeAdmins: number | null
  totalInterns: number | null
  activeInternships: number | null
  pendingDeliverables: number | null
}

interface ChartData {
  internsByDepartment: Array<{ name: string; value: number }>
  internshipsByStatus: Array<{ name: string; value: number }>
  internshipsByType: Array<{ name: string; value: number }>
}

interface UseSuperAdminStatsReturn {
  stats: KPIStats
  charts: ChartData
  loading: {
    kpis: boolean
    charts: boolean
  }
  errors: {
    kpis: string | null
    charts: string | null
  }
  refreshKpis: () => Promise<void>
  refreshCharts: () => Promise<void>
}

const readNumericValue = (payload: unknown): number => {
  if (typeof payload === 'number') return payload
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>
    const count = record.count
    const value = record.value
    if (typeof count === 'number') return count
    if (typeof value === 'number') return value
  }
  return 0
}

const readArrayData = <T,>(payload: { data?: T[] } | T[] | undefined): T[] => {
  if (Array.isArray(payload)) return payload
  return payload?.data ?? []
}

export function useSuperAdminStats(): UseSuperAdminStatsReturn {
  const api = useDashboardApi()

  const [stats, setStats] = useState<KPIStats>({
    activeInterns: null,
    activeSupervisors: null,
    totalMissions: null,
    activeAdmins: null,
    totalInterns: null,
    activeInternships: null,
    pendingDeliverables: null,
  })

  const [charts, setCharts] = useState<ChartData>({
    internsByDepartment: [],
    internshipsByStatus: [],
    internshipsByType: [],
  })

  const [loading, setLoading] = useState({
    kpis: true,
    charts: true,
  })

  const [errors, setErrors] = useState({
    kpis: null as string | null,
    charts: null as string | null,
  })

  const refreshKpis = useCallback(async () => {
    setLoading(prev => ({ ...prev, kpis: true }))
    setErrors(prev => ({ ...prev, kpis: null }))
    try {
      const [
        activeInternsRes,
        activeSupervisorsRes,
        totalMissionsRes,
        activeAdminsRes,
        totalInternsRes,
        activeInternshipsRes,
        pendingDeliverablesRes,
      ] = await Promise.all([
        api.get<{ count?: number } | number>('/api/stats/interns/active'),
        api.get<{ count?: number } | number>('/api/stats/supervisors'),
        api.get<{ count?: number } | number>('/api/stats/missions'),
        api.get<{ count?: number } | number>('/api/stats/admins'),
        api.get<{ count?: number } | number>('/api/stats/interns/count'),
        api.get<{ count?: number } | number>('/api/stats/internships/active'),
        api.get<{ count?: number } | number>('/api/stats/deliverables/pending'),
      ])

      setStats({
        activeInterns: readNumericValue(activeInternsRes),
        activeSupervisors: readNumericValue(activeSupervisorsRes),
        totalMissions: readNumericValue(totalMissionsRes),
        activeAdmins: readNumericValue(activeAdminsRes),
        totalInterns: readNumericValue(totalInternsRes),
        activeInternships: readNumericValue(activeInternshipsRes),
        pendingDeliverables: readNumericValue(pendingDeliverablesRes),
      })
    } catch (err) {
      setErrors(prev => ({
        ...prev,
        kpis: err instanceof Error ? err.message : 'Failed to load KPIs',
      }))
    } finally {
      setLoading(prev => ({ ...prev, kpis: false }))
    }
  }, [api])

  const refreshCharts = useCallback(async () => {
    setLoading(prev => ({ ...prev, charts: true }))
    setErrors(prev => ({ ...prev, charts: null }))
    try {
      const [byDept, byStatus, byType] = await Promise.all([
        api.get<{ data?: Array<{ name: string; value: number }> } | Array<{ name: string; value: number }>>('/api/stats/interns-by-department'),
        api.get<{ data?: Array<{ name: string; value: number }> } | Array<{ name: string; value: number }>>('/api/stats/internships-by-status'),
        api.get<{ data?: Array<{ name: string; value: number }> } | Array<{ name: string; value: number }>>('/api/stats/internships-by-type'),
      ])

      setCharts({
        internsByDepartment: readArrayData(byDept),
        internshipsByStatus: readArrayData(byStatus),
        internshipsByType: readArrayData(byType),
      })
    } catch (err) {
      setErrors(prev => ({
        ...prev,
        charts: err instanceof Error ? err.message : 'Failed to load charts',
      }))
    } finally {
      setLoading(prev => ({ ...prev, charts: false }))
    }
  }, [api])

  useEffect(() => {
    void refreshKpis()
    void refreshCharts()
  }, [refreshKpis, refreshCharts])

  return {
    stats,
    charts,
    loading,
    errors,
    refreshKpis,
    refreshCharts,
  }
}

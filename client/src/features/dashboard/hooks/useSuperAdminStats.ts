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

const extractNumber = (value: unknown): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    return isNaN(parsed) ? 0 : parsed
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (typeof record.count === 'number') return record.count
    if (typeof record.value === 'number') return record.value
  }
  return 0
}

const extractArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    if (Array.isArray(record.data)) return record.data as T[]
  }
  return []
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
    setLoading((prev) => ({ ...prev, kpis: true }))
    setErrors((prev) => ({ ...prev, kpis: null }))
    try {
      const response = await api.get<{
        activeInterns?: unknown
        activeSupervisors?: unknown
        totalMissions?: unknown
        activeAdmins?: unknown
        totalInterns?: unknown
        activeInternships?: unknown
        pendingDeliverables?: unknown
      }>('/api/stats/dashboard')

      setStats({
        activeInterns: extractNumber(response.activeInterns ?? response.activeInterns),
        activeSupervisors: extractNumber(response.activeSupervisors ?? response.activeSupervisors),
        totalMissions: extractNumber(response.totalMissions ?? response.totalMissions),
        activeAdmins: extractNumber(response.activeAdmins ?? response.activeAdmins),
        totalInterns: extractNumber(response.totalInterns ?? response.totalInterns),
        activeInternships: extractNumber(response.activeInternships ?? response.activeInternships),
        pendingDeliverables: extractNumber(response.pendingDeliverables ?? response.pendingDeliverables),
      })
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        kpis: err instanceof Error ? err.message : 'Failed to load KPIs',
      }))
    } finally {
      setLoading((prev) => ({ ...prev, kpis: false }))
    }
  }, [api])

  const refreshCharts = useCallback(async () => {
    setLoading((prev) => ({ ...prev, charts: true }))
    setErrors((prev) => ({ ...prev, charts: null }))
    try {
      const response = await api.get<{
        internsByDepartment?: unknown
        internshipsByStatus?: unknown
        internshipsByType?: unknown
      }>('/api/stats/charts')

      setCharts({
        internsByDepartment: extractArray(response.internsByDepartment),
        internshipsByStatus: extractArray(response.internshipsByStatus),
        internshipsByType: extractArray(response.internshipsByType),
      })
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        charts: err instanceof Error ? err.message : 'Failed to load charts',
      }))
    } finally {
      setLoading((prev) => ({ ...prev, charts: false }))
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

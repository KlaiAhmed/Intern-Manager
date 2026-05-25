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

interface ChartDatum {
  name: string
  value: number
}

interface ChartData {
  internsByDepartment: ChartDatum[]
  internshipsByStatus: ChartDatum[]
  internshipsByType: ChartDatum[]
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
    const parsed = Number.parseInt(value, 10)
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

const normalizeStatusKey = (value: string): string => {
  return value.trim().toLowerCase().replace(/[\s_-]/g, '')
}

const chartSeriesFromUnknown = (value: unknown): ChartDatum[] => {
  return extractArray<Record<string, unknown>>(value)
    .map((item) => ({
      name: String(item.name ?? ''),
      value: extractNumber(item.value),
    }))
    .filter((item) => item.name.trim().length > 0)
}

const activeInternshipStatusKeys = new Set(['active', 'actif'])

const statusCacheTtlMs = 15_000
const internshipsStatusCache: {
  data: ChartDatum[] | null
  fetchedAt: number
  promise: Promise<ChartDatum[]> | null
} = {
  data: null,
  fetchedAt: 0,
  promise: null,
}

export function useSuperAdminStats(): UseSuperAdminStatsReturn {
  const { get } = useDashboardApi()

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

  const loadInternshipsByStatus = useCallback(async () => {
    const now = Date.now()
    if (internshipsStatusCache.data && now - internshipsStatusCache.fetchedAt < statusCacheTtlMs) {
      return internshipsStatusCache.data
    }

    if (internshipsStatusCache.promise) {
      return internshipsStatusCache.promise
    }

    const request = get<{ data?: unknown }>('/api/stats/internships-by-status')
      .then((response) => {
        const series = chartSeriesFromUnknown(response.data)
        internshipsStatusCache.data = series
        internshipsStatusCache.fetchedAt = Date.now()
        return series
      })
      .finally(() => {
        internshipsStatusCache.promise = null
      })

    internshipsStatusCache.promise = request
    return request
  }, [get])

  const refreshKpis = useCallback(async () => {
    setLoading((prev) => ({ ...prev, kpis: true }))
    setErrors((prev) => ({ ...prev, kpis: null }))

    try {
      const [
        activeInternsResponse,
        activeSupervisorsResponse,
        totalMissionsResponse,
        activeAdminsResponse,
        pendingDeliverablesResponse,
        internshipsByStatusSeries,
      ] = await Promise.all([
        get<{ count?: unknown }>('/api/stats/interns/count'),
        get<{ count?: unknown }>('/api/stats/supervisors/count'),
        get<{ count?: unknown }>('/api/stats/missions'),
        get<{ count?: unknown }>('/api/stats/admins'),
        get<{ count?: unknown }>('/api/stats/deliverables/pending'),
        loadInternshipsByStatus(),
      ])

      const internshipStatusSeries = internshipsByStatusSeries
      const totalInterns = internshipStatusSeries.reduce((sum, item) => sum + item.value, 0)
      const activeInternships = internshipStatusSeries
        .filter((item) => activeInternshipStatusKeys.has(normalizeStatusKey(item.name)))
        .reduce((sum, item) => sum + item.value, 0)

      setStats({
        activeInterns: extractNumber(activeInternsResponse.count),
        activeSupervisors: extractNumber(activeSupervisorsResponse.count),
        totalMissions: extractNumber(totalMissionsResponse.count),
        activeAdmins: extractNumber(activeAdminsResponse.count),
        totalInterns,
        activeInternships,
        pendingDeliverables: extractNumber(pendingDeliverablesResponse.count),
      })
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        kpis: err instanceof Error ? err.message : 'Failed to load KPIs',
      }))
    } finally {
      setLoading((prev) => ({ ...prev, kpis: false }))
    }
  }, [get])

  const refreshCharts = useCallback(async () => {
    setLoading((prev) => ({ ...prev, charts: true }))
    setErrors((prev) => ({ ...prev, charts: null }))

    try {
      const [internsByDepartmentResponse, internshipsByStatusSeries, internshipsByTypeResponse] = await Promise.all([
        get<{ data?: unknown }>('/api/stats/interns-by-department'),
        loadInternshipsByStatus(),
        get<{ data?: unknown }>('/api/stats/internships-by-type'),
      ])

      setCharts({
        internsByDepartment: chartSeriesFromUnknown(internsByDepartmentResponse.data),
        internshipsByStatus: internshipsByStatusSeries,
        internshipsByType: chartSeriesFromUnknown(internshipsByTypeResponse.data),
      })
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        charts: err instanceof Error ? err.message : 'Failed to load charts',
      }))
    } finally {
      setLoading((prev) => ({ ...prev, charts: false }))
    }
  }, [get])

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

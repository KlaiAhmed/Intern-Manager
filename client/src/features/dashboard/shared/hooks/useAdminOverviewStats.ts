import { useCallback, useEffect, useState } from 'react'
import { useDashboardApi } from '../../hooks/useDashboardApi'
import type { AdminOverviewStats, CountResponse } from '../types/operations'
import { readCount } from '../utils/operations'
import { toDashboardErrorMessage } from '../utils/errorMessage'

interface ChartDatum {
  name: string
  value: number
}

interface ChartData {
  internsByDepartment: ChartDatum[]
  internshipsByStatus: ChartDatum[]
  internshipsByType: ChartDatum[]
}

interface LoadingState {
  kpis: boolean
  charts: boolean
}

interface ErrorState {
  kpis: string | null
  charts: string | null
}

interface UseAdminOverviewStatsResult {
  stats: AdminOverviewStats
  charts: ChartData
  loading: LoadingState
  errors: ErrorState
  refreshKpis: () => Promise<void>
  refreshCharts: () => Promise<void>
}

const initialStats: AdminOverviewStats = {
  activeInterns: 0,
  activeSupervisors: 0,
  totalMissions: 0,
  activeAdmins: 0,
  totalInterns: 0,
  activeInternships: 0,
  pendingDeliverables: 0,
}

const initialCharts: ChartData = {
  internsByDepartment: [],
  internshipsByStatus: [],
  internshipsByType: [],
}

const activeInternshipStatusKeys = new Set(['active', 'actif'])

const extractNumber = (value: unknown): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    return Number.isNaN(parsed) ? 0 : parsed
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

export function useAdminOverviewStats(): UseAdminOverviewStatsResult {
  const api = useDashboardApi()

  const [loading, setLoading] = useState<LoadingState>({
    kpis: true,
    charts: true,
  })
  const [errors, setErrors] = useState<ErrorState>({
    kpis: null,
    charts: null,
  })
  const [stats, setStats] = useState<AdminOverviewStats>(initialStats)
  const [charts, setCharts] = useState<ChartData>(initialCharts)

  const refreshKpis = useCallback(async () => {
    setLoading((current) => ({ ...current, kpis: true }))
    setErrors((current) => ({ ...current, kpis: null }))

    try {
      const [activeInternsResponse, activeSupervisorsResponse, totalMissionsResponse, activeAdminsResponse, pendingDeliverablesResponse, internshipsByStatusResponse] = await Promise.all([
        api.get<CountResponse>('/api/stats/interns/count'),
        api.get<CountResponse>('/api/stats/supervisors/count'),
        api.get<CountResponse>('/api/stats/missions'),
        api.get<CountResponse>('/api/stats/admins'),
        api.get<CountResponse>('/api/stats/deliverables/pending'),
        api.get<{ data?: unknown }>('/api/stats/internships-by-status'),
      ])

      const internshipStatusSeries = chartSeriesFromUnknown(internshipsByStatusResponse.data)
      const totalInterns = internshipStatusSeries.reduce((sum, item) => sum + item.value, 0)
      const activeInternships = internshipStatusSeries
        .filter((item) => activeInternshipStatusKeys.has(normalizeStatusKey(item.name)))
        .reduce((sum, item) => sum + item.value, 0)

      setStats({
        activeInterns: readCount(activeInternsResponse),
        activeSupervisors: readCount(activeSupervisorsResponse),
        totalMissions: readCount(totalMissionsResponse),
        activeAdmins: readCount(activeAdminsResponse),
        totalInterns,
        activeInternships,
        pendingDeliverables: readCount(pendingDeliverablesResponse),
      })
    } catch (requestError) {
      setErrors((current) => ({
        ...current,
        kpis: toDashboardErrorMessage(requestError),
      }))
      setStats(initialStats)
    } finally {
      setLoading((current) => ({ ...current, kpis: false }))
    }
  }, [api])

  const refreshCharts = useCallback(async () => {
    setLoading((current) => ({ ...current, charts: true }))
    setErrors((current) => ({ ...current, charts: null }))

    try {
      const [internsByDepartmentResponse, internshipsByStatusResponse, internshipsByTypeResponse] = await Promise.all([
        api.get<{ data?: unknown }>('/api/stats/interns-by-department'),
        api.get<{ data?: unknown }>('/api/stats/internships-by-status'),
        api.get<{ data?: unknown }>('/api/stats/internships-by-type'),
      ])

      setCharts({
        internsByDepartment: chartSeriesFromUnknown(internsByDepartmentResponse.data),
        internshipsByStatus: chartSeriesFromUnknown(internshipsByStatusResponse.data),
        internshipsByType: chartSeriesFromUnknown(internshipsByTypeResponse.data),
      })
    } catch (requestError) {
      setErrors((current) => ({
        ...current,
        charts: toDashboardErrorMessage(requestError),
      }))
      setCharts(initialCharts)
    } finally {
      setLoading((current) => ({ ...current, charts: false }))
    }
  }, [api])

  useEffect(() => {
    void refreshKpis()
    void refreshCharts()
  }, [refreshCharts, refreshKpis])

  return {
    stats,
    charts,
    loading,
    errors,
    refreshKpis,
    refreshCharts,
  }
}

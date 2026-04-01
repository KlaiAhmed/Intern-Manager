import { useState, useEffect, useCallback } from 'react'
import { useDashboardApi } from './useDashboardApi'

export interface AuditLog {
  id: string
  actor: string
  action: string
  entity: string
  timestamp: string
  details?: Record<string, unknown>
}

interface UseAuditLogsReturn {
  logs: AuditLog[]
  loading: boolean
  error: string | null
  page: number
  totalPages: number
  filter: {
    actor: string
    action: string
  }
  setFilter: (filter: Partial<{ actor: string; action: string }>) => void
  goToPage: (page: number) => void
  refresh: () => Promise<void>
}

const parseApiLog = (log: Record<string, unknown>): AuditLog => ({
  id: String(log.id ?? log.logId ?? ''),
  actor: String(log.actor ?? log.userName ?? log.userId ?? ''),
  action: String(log.action ?? log.event ?? log.type ?? ''),
  entity: String(log.entity ?? log.entityType ?? log.resource ?? ''),
  timestamp: String(log.timestamp ?? log.createdAt ?? log.date ?? new Date().toISOString()),
  details: (log.details ?? log.metadata ?? {}) as Record<string, unknown>,
})

export function useAuditLogs(): UseAuditLogsReturn {
  const api = useDashboardApi()

  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filter, setFilterState] = useState({
    actor: '',
    action: '',
  })

  const fetchLogs = useCallback(
    async (currentPage: number, currentFilter: typeof filter) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set('page', String(currentPage))
        params.set('limit', '20')
        if (currentFilter.actor) params.set('actor', currentFilter.actor)
        if (currentFilter.action) params.set('action', currentFilter.action)

        const result = await api.get<{
          data: Record<string, unknown>[]
          total: number
        }>(`/api/admin/audit-logs?${params.toString()}`)

        const mappedLogs = (result.data ?? []).map(parseApiLog)
        setLogs(mappedLogs)
        setTotalPages(Math.max(1, Math.ceil((result.total ?? 0) / 20)))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load audit logs')
      } finally {
        setLoading(false)
      }
    },
    [api]
  )

  const setFilter = useCallback((newFilter: Partial<typeof filter>) => {
    setFilterState((prev) => ({ ...prev, ...newFilter }))
    setPage(1)
  }, [])

  const goToPage = useCallback(
    (newPage: number) => {
      if (newPage >= 1 && newPage <= totalPages) {
        setPage(newPage)
      }
    },
    [totalPages]
  )

  const refresh = useCallback(async () => {
    await fetchLogs(page, filter)
  }, [fetchLogs, page, filter])

  useEffect(() => {
    void fetchLogs(page, filter)
  }, [fetchLogs, page, filter])

  return {
    logs,
    loading,
    error,
    page,
    totalPages,
    filter,
    setFilter,
    goToPage,
    refresh,
  }
}

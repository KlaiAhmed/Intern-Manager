import { useState, useEffect, useCallback } from 'react'
import { useDashboardApi } from './useDashboardApi'

export interface User {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'inactive' | 'archived'
  department: string
  created: string
}

interface UseUserManagementReturn {
  users: User[]
  loading: boolean
  error: string | null
  page: number
  totalPages: number
  filters: {
    role: string
    status: string
    department: string
    search: string
  }
  setFilters: (filters: Partial<{ role: string; status: string; department: string; search: string }>) => void
  goToPage: (page: number) => void
  refresh: () => Promise<void>
  createUser: (userData: Omit<User, 'id' | 'created'>) => Promise<void>
  updateUser: (id: string, userData: Partial<User>) => Promise<void>
  archiveUser: (id: string) => Promise<void>
  deleteUser: (id: string) => Promise<void>
}

const mapApiUserToUser = (apiUser: Record<string, unknown>): User => ({
  id: String(apiUser.id ?? ''),
  name: String(apiUser.name ?? `${apiUser.firstName ?? ''} ${apiUser.lastName ?? ''}`.trim()),
  email: String(apiUser.email ?? ''),
  role: String(apiUser.role ?? ''),
  status: (apiUser.status as 'active' | 'inactive' | 'archived') || 'active',
  department: String(apiUser.department ?? ''),
  created: String(apiUser.createdAt ?? apiUser.created ?? new Date().toISOString()),
})

export function useUserManagement(): UseUserManagementReturn {
  const api = useDashboardApi()

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filters, setFiltersState] = useState({
    role: '',
    status: '',
    department: '',
    search: '',
  })

  const fetchUsers = useCallback(async (currentPage: number, currentFilters: typeof filters) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(currentPage))
      params.set('limit', '10')
      if (currentFilters.role) params.set('role', currentFilters.role)
      if (currentFilters.status) params.set('status', currentFilters.status)
      if (currentFilters.department) params.set('department', currentFilters.department)
      if (currentFilters.search) params.set('search', currentFilters.search)

      const result = await api.get<{ data: Record<string, unknown>[]; total: number }>(`/api/users?${params.toString()}`)
      const mappedUsers = (result.data ?? []).map(mapApiUserToUser)
      setUsers(mappedUsers)
      setTotalPages(Math.max(1, Math.ceil((result.total ?? 0) / 10)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [api])

  const setFilters = useCallback((newFilters: Partial<typeof filters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }))
    setPage(1)
  }, [])

  const goToPage = useCallback((newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage)
    }
  }, [totalPages])

  const refresh = useCallback(async () => {
    await fetchUsers(page, filters)
  }, [fetchUsers, page, filters])

  const createUser = useCallback(async (userData: Omit<User, 'id' | 'created'>) => {
    await api.post('/api/users', userData)
    await refresh()
  }, [api, refresh])

  const updateUser = useCallback(async (id: string, userData: Partial<User>) => {
    await api.patch(`/api/users/${id}`, userData)
    await refresh()
  }, [api, refresh])

  const archiveUser = useCallback(async (id: string) => {
    await api.patch(`/api/users/${id}`, { status: 'archived' })
    await refresh()
  }, [api, refresh])

  const deleteUser = useCallback(async (id: string) => {
    await api.del(`/api/users/${id}`)
    await refresh()
  }, [api, refresh])

  useEffect(() => {
    void fetchUsers(page, filters)
  }, [fetchUsers, page, filters])

  return {
    users,
    loading,
    error,
    page,
    totalPages,
    filters,
    setFilters,
    goToPage,
    refresh,
    createUser,
    updateUser,
    archiveUser,
    deleteUser,
  }
}

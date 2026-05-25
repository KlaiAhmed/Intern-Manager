import { useState, useEffect, useCallback } from 'react'
import { useDashboardApi } from './useDashboardApi'

export interface User {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'archived'
  department: string
  created: string
}

export interface DepartmentOption {
  id: string
  name: string
}

export interface UserDeletionBlockers {
  missionsAsSupervisor?: number
  deliverablesAsSupervisor?: number
  evaluations?: number
  meetings?: number
  journalComments?: number
  journalEvaluationLinks?: number
}

type UserUpsertPayload = Omit<User, 'id' | 'created'> & {
  password?: string
}

interface UseUserManagementReturn {
  users: User[]
  departments: DepartmentOption[]
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
  createUser: (userData: UserUpsertPayload) => Promise<void>
  updateUser: (id: string, userData: Partial<UserUpsertPayload>) => Promise<void>
  archiveUser: (id: string) => Promise<void>
  deleteUser: (id: string) => Promise<void>
}

const guidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isGuid(value: string): boolean {
  return guidPattern.test(value.trim())
}

function normalizeStatus(status: string | undefined): User['status'] {
  const normalized = String(status ?? '').trim().toLowerCase()
  return normalized === 'archived' || normalized === 'inactive' ? 'archived' : 'active'
}

function parseDepartmentOptions(payload: unknown): DepartmentOption[] {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null
        }

        const record = item as Record<string, unknown>
        const id = String(record.id ?? '')
        const name = String(record.name ?? '')

        if (!id || !name) {
          return null
        }

        return { id, name }
      })
      .filter((item): item is DepartmentOption => item !== null)
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if (Array.isArray(record.data)) {
      return parseDepartmentOptions(record.data)
    }
  }

  return []
}

function buildUserUpsertPayload(userData: Partial<UserUpsertPayload>): Record<string, string> {
  const payload: Record<string, string> = {}

  if (typeof userData.name === 'string' && userData.name.trim()) {
    payload.name = userData.name.trim()
  }

  if (typeof userData.email === 'string' && userData.email.trim()) {
    payload.email = userData.email.trim()
  }

  if (typeof userData.role === 'string' && userData.role.trim()) {
    payload.role = userData.role.trim()
  }

  if (typeof userData.password === 'string' && userData.password.trim()) {
    payload.password = userData.password.trim()
  }

  if (typeof userData.status === 'string' && userData.status.trim()) {
    payload.status = normalizeStatus(userData.status)
  }

  if (typeof userData.department === 'string' && isGuid(userData.department)) {
    payload.department = userData.department.trim()
  }

  return payload
}

const mapApiUserToUser = (apiUser: Record<string, unknown>): User => ({
  id: String(apiUser.id ?? ''),
  name: String(apiUser.name ?? `${apiUser.firstName ?? ''} ${apiUser.lastName ?? ''}`.trim()),
  email: String(apiUser.email ?? ''),
  role: String(apiUser.role ?? ''),
  status: normalizeStatus(String(apiUser.status ?? 'active')),
  department: String(apiUser.department ?? ''),
  created: String(apiUser.createdAt ?? apiUser.created ?? new Date().toISOString()),
})

export function useUserManagement(): UseUserManagementReturn {
  const { get, post, patch, del } = useDashboardApi()

  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
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

      const result = await get<{ data: Record<string, unknown>[]; total: number }>(`/api/users?${params.toString()}`)
      const mappedUsers = (result.data ?? []).map(mapApiUserToUser)
      setUsers(mappedUsers)
      setTotalPages(Math.max(1, Math.ceil((result.total ?? 0) / 10)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [get])

  const fetchDepartments = useCallback(async () => {
    try {
      const result = await get<unknown>('/api/admin/settings/departments')
      setDepartments(parseDepartmentOptions(result))
    } catch {
      setDepartments([])
    }
  }, [get])

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

  const createUser = useCallback(async (userData: UserUpsertPayload) => {
    await post('/api/users', buildUserUpsertPayload(userData))
    await refresh()
  }, [post, refresh])

  const updateUser = useCallback(async (id: string, userData: Partial<UserUpsertPayload>) => {
    await patch(`/api/users/${id}`, buildUserUpsertPayload(userData))
    await refresh()
  }, [patch, refresh])

  const archiveUser = useCallback(async (id: string) => {
    await patch(`/api/users/${id}/archive`, {})
    await refresh()
  }, [patch, refresh])

  const deleteUser = useCallback(async (id: string) => {
    const shouldMoveBack = users.length === 1 && page > 1
    const nextPage = shouldMoveBack ? page - 1 : page

    await del(`/api/users/${id}`)

    if (shouldMoveBack) {
      setPage(nextPage)
      await fetchUsers(nextPage, filters)
      return
    }

    await fetchUsers(page, filters)
  }, [del, fetchUsers, filters, page, users.length])

  useEffect(() => {
    void fetchDepartments()
  }, [fetchDepartments])

  useEffect(() => {
    void fetchUsers(page, filters)
  }, [fetchUsers, page, filters])

  return {
    users,
    departments,
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

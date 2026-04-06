export interface Intern {
  id: string
  name: string
  email: string
  department?: string
  missionTitle?: string
  supervisorName?: string
  startDate?: string
  endDate?: string
  progress: number
  status: 'active' | 'completed' | 'pending'
}

export interface Supervisor {
  id: string
  name: string
  email: string
  department?: string
  activeInternsCount: number
}

export interface Department {
  id: string
  name: string
  internCount: number
  supervisorCount: number
  avgProgress: number
}

export interface Activity {
  id: string
  type: 'submission' | 'evaluation' | 'mission_created' | 'meeting'
  actor: string
  description: string
  timestamp: string
}

export interface PagedResponse<T> {
  data?: T[]
  total?: number
  page?: number
  limit?: number
}

export interface UserRecord {
  id?: string
  name?: string
  firstName?: string
  lastName?: string
  email?: string
  department?: string
  status?: string
}

export interface InternshipRecord {
  id?: string
  missionTitle?: string
  internId?: string
  supervisorId?: string
  supervisorName?: string
  department?: string
  startDate?: string
  endDate?: string
  status?: string
}

export interface AuditLogRecord {
  id?: string
  actor?: string
  action?: string
  timestamp?: string
  createdAt?: string
  description?: string
}

export interface DepartmentRecord {
  id?: string
  name?: string
}

export type ManagerTabId = 'overview' | 'interns' | 'supervisors' | 'departments'

export interface ManagerNavItem {
  id: ManagerTabId
  label: string
  icon: 'overview' | 'interns' | 'supervisors' | 'departments'
  badge?: number
}

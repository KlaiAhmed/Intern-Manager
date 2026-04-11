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
  accountStatus?: string
  verificationStatus?: string
  cvFileUrl?: string | null
  internshipId?: string
  internshipType?: string
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
  verificationStatus?: string
}

export interface InternshipRecord {
  id?: string
  missionTitle?: string
  internId?: string
  supervisorId?: string
  supervisorName?: string
  department?: string
  type?: string
  startDate?: string
  endDate?: string
  status?: string
}

export interface InternDirectoryRecord {
  id?: string
  fullName?: string
  email?: string
  status?: string
  verificationStatus?: string
  cvFileUrl?: string | null
  startDate?: string | null
  endDate?: string | null
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

export type ManagerTabId = 'overview' | 'interns' | 'supervisors' | 'departments' | 'biPanel'

export interface ManagerNavItem {
  id: ManagerTabId
  label: string
  icon: 'overview' | 'interns' | 'supervisors' | 'departments' | 'biPanel'
  badge?: number
}

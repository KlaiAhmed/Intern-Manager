export type AccountStatus = 'active' | 'archived'
export type ManageableRole = 'manager' | 'supervisor' | 'intern'
export type InternshipDetailsTab = 'details' | 'history'
export type SettingsTab =
  | 'departments'
  | 'schools'
  | 'internship-types'
  | 'skills'
  | 'verification-statuses'

export interface CountResponse {
  count?: number
}

export interface PagedResponse<T> {
  data?: T[]
  total?: number
  page?: number
  limit?: number
}

export interface DashboardUserApi {
  id?: string
  firstName?: string
  lastName?: string
  fullName?: string
  name?: string
  email?: string
  role?: string
  status?: string
  department?: string
  lastLogin?: string
}

export interface DashboardUser {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  role: string
  status: AccountStatus
  department: string
}

export interface InternApi {
  id?: string
  fullName?: string
  email?: string
  status?: string
  accountStatus?: string
  verificationStatus?: string
  cvFileUrl?: string | null
  startDate?: string | null
  endDate?: string | null
}

export interface InternRecord {
  id: string
  fullName: string
  email: string
  accountStatus: string
  verificationStatus: string
  cvFileUrl: string | null
  startDate: string | null
  endDate: string | null
}

export interface InternshipApi {
  id?: string
  missionTitle?: string
  internId?: string | null
  internName?: string | null
  supervisorId?: string
  supervisorName?: string | null
  coSupervisorId?: string | null
  department?: string | null
  type?: string | null
  status?: string
  startDate?: string
  endDate?: string | null
  objectives?: string
}

export interface InternshipRecord {
  id: string
  missionTitle: string
  internId: string | null
  internName: string | null
  supervisorId: string
  supervisorName: string | null
  coSupervisorId: string | null
  department: string | null
  type: string | null
  status: string
  startDate: string
  endDate: string | null
  objectives: string
}

export interface InternshipHistoryApi {
  id?: string
  field?: string
  oldValue?: string | null
  newValue?: string | null
  changedBy?: string
  changedAt?: string
}

export interface InternshipHistoryRecord {
  id: string
  field: string
  oldValue: string
  newValue: string
  changedBy: string
  changedAt: string
}

export interface EvaluationApi {
  id?: string
  supervisorId?: string
  supervisorName?: string
  internId?: string
  internName?: string
  type?: string
  status?: string
  submittedAt?: string | null
  comments?: string | null
  criteria?: {
    technical?: number
    autonomy?: number
    communication?: number
    deadlineRespect?: number
    deliverableQuality?: number
  }
}

export interface EvaluationRecord {
  id: string
  supervisorId: string
  supervisorName: string
  internId: string
  internName: string
  type: string
  status: string
  submittedAt: string | null
  comments: string
  technical: number
  autonomy: number
  communication: number
  deadlineRespect: number
  deliverableQuality: number
}

export interface ReferentialApi {
  id?: string
  name?: string
}

export interface ReferentialRecord {
  id: string
  name: string
}

export interface AuditLogApi {
  id?: string
  actor?: string
  action?: string
  entity?: string
  timestamp?: string
}

export interface AuditLogRecord {
  id: string
  actor: string
  action: string
  entity: string
  timestamp: string
}

export interface NotificationRule {
  id: string
  name: string
  enabled: boolean
  trigger: string
}

export interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
}

export interface ArchiveHistoryRecord {
  id: string
  year: number
  triggeredBy: string
  triggeredAt: string
  status: string
}

export interface BiAccessMatrix {
  role: string
  dashboards: Record<string, boolean>
}

export interface InternshipFormState {
  missionTitle: string
  supervisorId: string
  coSupervisorId: string
  department: string
  type: string
  status: string
  startDate: string
  endDate: string
  objectives: string
}

export interface EmailTemplateFormState {
  id: string
  name: string
  subject: string
  body: string
}

export interface AdminOverviewStats {
  activeInterns: number
  activeSupervisors: number
  totalMissions: number
  activeAdmins: number
  totalInterns: number
  activeInternships: number
  pendingDeliverables: number
}

export const defaultInternshipFormState: InternshipFormState = {
  missionTitle: '',
  supervisorId: '',
  coSupervisorId: '',
  department: '',
  type: '',
  status: 'template',
  startDate: '',
  endDate: '',
  objectives: '',
}

export const defaultEmailTemplateFormState: EmailTemplateFormState = {
  id: '',
  name: '',
  subject: '',
  body: '',
}

export const roleRows = ['SuperAdmin', 'Admin', 'Manager', 'Supervisor', 'Intern']
export const dashboardColumns = ['Executive', 'Operations', 'Evaluation', 'Recruitment']

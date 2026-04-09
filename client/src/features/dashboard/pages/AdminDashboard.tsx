import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Input } from '../../../components/ui/Input'
import {
  Archive,
  Download,
  Edit,
  FileCheck,
  Filter,
  FolderOpen,
  Plus,
  Search,
  Target,
  Trash2,
  User,
  Users,
} from '../components/IconComponents'
import { DashboardButton } from '../components/DashboardButton'
import { ErrorState } from '../components/ErrorState'
import { Modal } from '../components/Modal'
import { Panel } from '../components/Panel'
import { Skeleton } from '../components/Skeleton'
import { SuperAdminSidebar, type SuperAdminSection } from '../components/SuperAdminSidebar'
import { SuperAdminStatCard } from '../components/SuperAdminStatCard'
import { useDashboardApi } from '../hooks/useDashboardApi'
import '../styles/pages/AdminDashboard.css'

type DashboardApiClient = ReturnType<typeof useDashboardApi>

type AdminView =
  | 'overview'
  | 'users'
  | 'interns'
  | 'internships'
  | 'evaluations'
  | 'settings'
  | 'audit'
  | 'notificationsEmail'
  | 'archive'
  | 'biAccess'

type AccountStatus = 'active' | 'archived'
type ManageableRole = 'manager' | 'supervisor' | 'intern'
type InternshipDetailsTab = 'details' | 'history'
type SettingsTab = 'departments' | 'schools' | 'internship-types' | 'skills' | 'verification-statuses'

interface CountResponse {
  count?: number
}

interface PagedResponse<T> {
  data?: T[]
  total?: number
  page?: number
  limit?: number
}

interface DashboardUserApi {
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

interface DashboardUser {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  role: string
  status: AccountStatus
  department: string
}

interface InternApi {
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

interface InternRecord {
  id: string
  fullName: string
  email: string
  accountStatus: string
  verificationStatus: string
  cvFileUrl: string | null
  startDate: string | null
  endDate: string | null
}

interface InternshipApi {
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

interface InternshipRecord {
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

interface InternshipHistoryApi {
  id?: string
  field?: string
  oldValue?: string | null
  newValue?: string | null
  changedBy?: string
  changedAt?: string
}

interface InternshipHistoryRecord {
  id: string
  field: string
  oldValue: string
  newValue: string
  changedBy: string
  changedAt: string
}

interface EvaluationApi {
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

interface EvaluationRecord {
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

interface ReferentialApi {
  id?: string
  name?: string
}

interface ReferentialRecord {
  id: string
  name: string
}

interface AuditLogApi {
  id?: string
  actor?: string
  action?: string
  entity?: string
  timestamp?: string
}

interface AuditLogRecord {
  id: string
  actor: string
  action: string
  entity: string
  timestamp: string
}

interface NotificationRule {
  id: string
  name: string
  enabled: boolean
  trigger: string
}

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
}

interface ArchiveHistoryRecord {
  id: string
  year: number
  triggeredBy: string
  triggeredAt: string
  status: string
}

interface BiAccessMatrix {
  role: string
  dashboards: Record<string, boolean>
}

interface UserFormState {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
  role: ManageableRole
  status: AccountStatus
  department: string
}

interface InternshipFormState {
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

interface EmailTemplateFormState {
  name: string
  subject: string
  body: string
}

const adminManageableRoles: ManageableRole[] = ['manager', 'supervisor', 'intern']
const accountStatuses: AccountStatus[] = ['active', 'archived']
const settingsTabs: Array<{ id: SettingsTab; label: string }> = [
  { id: 'departments', label: 'Departments' },
  { id: 'schools', label: 'Schools' },
  { id: 'internship-types', label: 'Internship Types' },
  { id: 'skills', label: 'Skills' },
  { id: 'verification-statuses', label: 'Verification Statuses' },
]

const defaultUserFormState: UserFormState = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'manager',
  status: 'active',
  department: '',
}

const defaultInternshipFormState: InternshipFormState = {
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

const defaultEmailTemplateFormState: EmailTemplateFormState = {
  name: '',
  subject: '',
  body: '',
}

const sectionPathMap: Record<SuperAdminSection, string> = {
  overview: '/dashboard/admin',
  users: '/dashboard/admin/users',
  internships: '/dashboard/admin/internships',
  missions: '/dashboard/admin/interns',
  evaluations: '/dashboard/admin/evaluations',
  deliverables: '/dashboard/admin/notifications-email',
  matching: '/dashboard/admin/archive',
  settings: '/dashboard/admin/settings',
  audit: '/dashboard/admin/audit',
}

const sectionByView: Record<AdminView, SuperAdminSection> = {
  overview: 'overview',
  users: 'users',
  interns: 'missions',
  internships: 'internships',
  evaluations: 'evaluations',
  settings: 'settings',
  audit: 'audit',
  notificationsEmail: 'deliverables',
  archive: 'matching',
  biAccess: 'settings',
}

const roleRows = ['SuperAdmin', 'Admin', 'Manager', 'Supervisor', 'Intern']
const dashboardColumns = ['Executive', 'Operations', 'Evaluation', 'Recruitment']

class PendingEndpointError extends Error {
  status: number
  endpoint: string

  constructor(endpoint: string) {
    super(`501 Not Implemented - endpoint pending: ${endpoint}`)
    this.name = 'PendingEndpointError'
    this.status = 501
    this.endpoint = endpoint
  }
}

function resolveAdminView(pathname: string): AdminView {
  if (pathname === '/dashboard/admin' || pathname === '/dashboard') {
    return 'overview'
  }

  if (pathname.startsWith('/dashboard/admin/users')) {
    return 'users'
  }

  if (pathname.startsWith('/dashboard/admin/interns')) {
    return 'interns'
  }

  if (pathname.startsWith('/dashboard/admin/internships')) {
    return 'internships'
  }

  if (pathname.startsWith('/dashboard/admin/evaluations')) {
    return 'evaluations'
  }

  if (pathname.startsWith('/dashboard/admin/audit')) {
    return 'audit'
  }

  if (pathname.startsWith('/dashboard/admin/notifications-email')) {
    return 'notificationsEmail'
  }

  if (pathname.startsWith('/dashboard/admin/archive')) {
    return 'archive'
  }

  if (pathname.startsWith('/dashboard/admin/bi-access')) {
    return 'biAccess'
  }

  return 'settings'
}

function normalizeRole(rawRole: string | undefined): string {
  if (!rawRole) {
    return ''
  }

  return rawRole.trim().toLowerCase().replace(/[\s-]/g, '_')
}

function isAdminRole(role: string | undefined): boolean {
  const normalizedRole = normalizeRole(role)
  return normalizedRole === 'admin' || normalizedRole === 'super_admin' || normalizedRole === 'superadmin'
}

function splitFullName(value: string): { firstName: string; lastName: string } {
  const parts = value.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return { firstName: '', lastName: '' }
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] }
  }

  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

function parseAccountStatus(value: string | undefined): AccountStatus {
  const normalized = value?.trim().toLowerCase()
  return normalized === 'archived' || normalized === 'inactive' ? 'archived' : 'active'
}

function toDateInputValue(value: string | null): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toIsoDate(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toISOString()
}

function readCount(payload: CountResponse | null | undefined): number {
  if (!payload || typeof payload.count !== 'number') {
    return 0
  }

  return payload.count
}

function mapUserApi(record: DashboardUserApi): DashboardUser | null {
  const id = String(record.id ?? '').trim()
  const email = String(record.email ?? '').trim()
  const role = String(record.role ?? '').trim().toLowerCase()

  if (!id || !email || !role) {
    return null
  }

  const rawFullName =
    String(record.fullName ?? '').trim() || String(record.name ?? '').trim() || `${record.firstName ?? ''} ${record.lastName ?? ''}`.trim()
  const fullName = rawFullName || email
  const splitName = splitFullName(fullName)

  return {
    id,
    firstName: String(record.firstName ?? '').trim() || splitName.firstName,
    lastName: String(record.lastName ?? '').trim() || splitName.lastName,
    fullName,
    email,
    role,
    status: parseAccountStatus(String(record.status ?? '')),
    department: String(record.department ?? '').trim(),
  }
}

function mapInternApi(record: InternApi): InternRecord | null {
  const id = String(record.id ?? '').trim()
  const fullName = String(record.fullName ?? '').trim()
  const email = String(record.email ?? '').trim()

  if (!id || !fullName || !email) {
    return null
  }

  return {
    id,
    fullName,
    email,
    accountStatus: String(record.accountStatus ?? record.status ?? '').trim() || 'Unknown',
    verificationStatus: String(record.verificationStatus ?? '').trim() || 'Unknown',
    cvFileUrl: record.cvFileUrl ?? null,
    startDate: record.startDate ?? null,
    endDate: record.endDate ?? null,
  }
}

function mapInternshipApi(record: InternshipApi): InternshipRecord | null {
  const id = String(record.id ?? '').trim()
  const supervisorId = String(record.supervisorId ?? '').trim()

  if (!id || !supervisorId) {
    return null
  }

  return {
    id,
    missionTitle: String(record.missionTitle ?? '').trim() || 'Untitled internship',
    internId: record.internId ? String(record.internId).trim() : null,
    internName: record.internName ? String(record.internName).trim() : null,
    supervisorId,
    supervisorName: record.supervisorName ? String(record.supervisorName).trim() : null,
    coSupervisorId: record.coSupervisorId ? String(record.coSupervisorId).trim() : null,
    department: record.department ? String(record.department).trim() : null,
    type: record.type ? String(record.type).trim() : null,
    status: String(record.status ?? '').trim() || 'template',
    startDate: String(record.startDate ?? '').trim(),
    endDate: record.endDate ? String(record.endDate).trim() : null,
    objectives: String(record.objectives ?? '').trim(),
  }
}

function mapHistoryApi(record: InternshipHistoryApi): InternshipHistoryRecord | null {
  const id = String(record.id ?? '').trim()
  const field = String(record.field ?? '').trim()

  if (!id || !field) {
    return null
  }

  return {
    id,
    field,
    oldValue: String(record.oldValue ?? ''),
    newValue: String(record.newValue ?? ''),
    changedBy: String(record.changedBy ?? 'Unknown').trim(),
    changedAt: String(record.changedAt ?? '').trim(),
  }
}

function mapEvaluationApi(record: EvaluationApi): EvaluationRecord | null {
  const id = String(record.id ?? '').trim()
  const supervisorId = String(record.supervisorId ?? '').trim()
  const internId = String(record.internId ?? '').trim()

  if (!id || !supervisorId || !internId) {
    return null
  }

  return {
    id,
    supervisorId,
    supervisorName: String(record.supervisorName ?? 'Unknown').trim(),
    internId,
    internName: String(record.internName ?? 'Unknown').trim(),
    type: String(record.type ?? '').trim() || 'unknown',
    status: String(record.status ?? '').trim() || 'unknown',
    submittedAt: record.submittedAt ?? null,
    comments: String(record.comments ?? '').trim(),
    technical: Number(record.criteria?.technical ?? 0),
    autonomy: Number(record.criteria?.autonomy ?? 0),
    communication: Number(record.criteria?.communication ?? 0),
    deadlineRespect: Number(record.criteria?.deadlineRespect ?? 0),
    deliverableQuality: Number(record.criteria?.deliverableQuality ?? 0),
  }
}

function mapReferentialApi(record: ReferentialApi): ReferentialRecord | null {
  const id = String(record.id ?? '').trim()
  const name = String(record.name ?? '').trim()

  if (!id || !name) {
    return null
  }

  return { id, name }
}

function mapAuditApi(record: AuditLogApi): AuditLogRecord | null {
  const id = String(record.id ?? '').trim()
  const actor = String(record.actor ?? '').trim()
  const action = String(record.action ?? '').trim()
  const entity = String(record.entity ?? '').trim()
  const timestamp = String(record.timestamp ?? '').trim()

  if (!id || !actor || !action || !entity || !timestamp) {
    return null
  }

  return {
    id,
    actor,
    action,
    entity,
    timestamp,
  }
}

function parseReferentialResponse(
  payload: ReferentialApi[] | PagedResponse<ReferentialApi> | null | undefined,
): ReferentialRecord[] {
  if (!payload) {
    return []
  }

  if (Array.isArray(payload)) {
    return payload.map(mapReferentialApi).filter((item): item is ReferentialRecord => item !== null)
  }

  return (payload.data ?? []).map(mapReferentialApi).filter((item): item is ReferentialRecord => item !== null)
}

function toCsvValue(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

function triggerCsvDownload(fileName: string, rows: string[][]): void {
  const csvContent = rows.map((row) => row.map(toCsvValue).join(',')).join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const blobUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = blobUrl
  anchor.setAttribute('download', fileName)
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(blobUrl)
}

function isStrongPassword(value: string): boolean {
  return (
    value.length >= 8
    && /[A-Z]/.test(value)
    && /[a-z]/.test(value)
    && /[0-9]/.test(value)
    && /[^A-Za-z0-9]/.test(value)
  )
}

function throwPendingEndpoint(endpoint: string): never {
  throw new PendingEndpointError(endpoint)
}

const pendingAdminServices = {
  async listNotificationRules(): Promise<NotificationRule[]> {
    // TODO(api): Implement GET /api/admin/notifications/rules for notification rules management.
    throwPendingEndpoint('GET /api/admin/notifications/rules')
  },
  async updateNotificationRule(ruleId: string, enabled: boolean): Promise<void> {
    // TODO(api): Implement PATCH /api/admin/notifications/rules/{ruleId} to update notification rules.
    void ruleId
    void enabled
    throwPendingEndpoint('PATCH /api/admin/notifications/rules/{ruleId}')
  },
  async listEmailTemplates(): Promise<EmailTemplate[]> {
    // TODO(api): Implement GET /api/admin/email-templates for email template management.
    throwPendingEndpoint('GET /api/admin/email-templates')
  },
  async saveEmailTemplate(template: EmailTemplateFormState): Promise<void> {
    // TODO(api): Implement PATCH /api/admin/email-templates/{id} for email template updates.
    void template
    throwPendingEndpoint('PATCH /api/admin/email-templates/{id}')
  },
  async triggerArchive(): Promise<void> {
    // TODO(api): Implement POST /api/admin/archive for annual archive execution.
    throwPendingEndpoint('POST /api/admin/archive')
  },
  async listArchiveHistory(): Promise<ArchiveHistoryRecord[]> {
    // TODO(api): Implement GET /api/admin/archive/history to list archive jobs.
    throwPendingEndpoint('GET /api/admin/archive/history')
  },
  async listBiAccessMatrix(): Promise<BiAccessMatrix[]> {
    // TODO(api): Implement GET /api/admin/bi-access for BI access matrix retrieval.
    throwPendingEndpoint('GET /api/admin/bi-access')
  },
  async saveBiAccessMatrix(matrix: BiAccessMatrix[]): Promise<void> {
    // TODO(api): Implement PATCH /api/admin/bi-access for BI access matrix updates.
    void matrix
    throwPendingEndpoint('PATCH /api/admin/bi-access')
  },
}

interface SectionProps {
  api: DashboardApiClient
  getErrorMessage: (error: unknown) => string
}

function OverviewSection({ api, getErrorMessage }: SectionProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalInterns: 0,
    activeInternships: 0,
    totalSupervisors: 0,
    pendingDeliverables: 0,
  })

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [internsCount, internshipsCount, supervisorsCount, deliverablesCount] = await Promise.all([
        api.get<CountResponse>('/api/stats/interns/count'),
        api.get<CountResponse>('/api/stats/internships/active'),
        api.get<CountResponse>('/api/stats/supervisors/count'),
        api.get<CountResponse>('/api/stats/deliverables/pending'),
      ])

      setStats({
        totalInterns: readCount(internsCount),
        activeInternships: readCount(internshipsCount),
        totalSupervisors: readCount(supervisorsCount),
        pendingDeliverables: readCount(deliverablesCount),
      })
    } catch (error) {
      setError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [api, getErrorMessage])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  return (
    <section className="overview-section admin-view-section" id="section-overview">
      <div className="kpi-row kpi-row-primary">
        {loading ? (
          <>
            <Skeleton height="140px" />
            <Skeleton height="140px" />
            <Skeleton height="140px" />
            <Skeleton height="140px" />
          </>
        ) : error ? (
          <div className="kpi-error-container">
            <ErrorState message={error} onRetry={() => void loadStats()} />
          </div>
        ) : (
          <>
            <SuperAdminStatCard
              label="Total Interns"
              value={stats.totalInterns.toLocaleString()}
              icon={<Users />}
              animationDelay={0}
            />
            <SuperAdminStatCard
              label="Active Internships"
              value={stats.activeInternships.toLocaleString()}
              icon={<FolderOpen />}
              variant="primary"
              animationDelay={60}
            />
            <SuperAdminStatCard
              label="Total Supervisors"
              value={stats.totalSupervisors.toLocaleString()}
              icon={<User />}
              animationDelay={120}
            />
            <SuperAdminStatCard
              label="Pending Deliverables"
              value={stats.pendingDeliverables.toLocaleString()}
              icon={<FileCheck />}
              variant="warning"
              animationDelay={180}
            />
          </>
        )}
      </div>

      <div className="charts-row">
        <h2 className="section-title charts-title">Analytics</h2>
        <div className="charts-grid">
          {/* TODO(api-access): Enable GET /api/stats/interns-by-department for Admin role access. */}
          <div className="chart-card admin-endpoint-placeholder-card">
            <h3 className="chart-title">Interns by Department</h3>
            <p className="admin-endpoint-placeholder-title">Endpoint not yet available for Admin role.</p>
            <p className="admin-endpoint-placeholder-text">Blocked endpoint: GET /api/stats/interns-by-department</p>
          </div>

          {/* TODO(api-access): Enable GET /api/stats/internships-by-status for Admin role access. */}
          <div className="chart-card admin-endpoint-placeholder-card">
            <h3 className="chart-title">Internships by Status</h3>
            <p className="admin-endpoint-placeholder-title">Endpoint not yet available for Admin role.</p>
            <p className="admin-endpoint-placeholder-text">Blocked endpoint: GET /api/stats/internships-by-status</p>
          </div>

          {/* TODO(api-access): Enable GET /api/stats/internships-by-type for Admin role access. */}
          <div className="chart-card admin-endpoint-placeholder-card">
            <h3 className="chart-title">Internships by Type</h3>
            <p className="admin-endpoint-placeholder-title">Endpoint not yet available for Admin role.</p>
            <p className="admin-endpoint-placeholder-text">Blocked endpoint: GET /api/stats/internships-by-type</p>
          </div>
        </div>
      </div>
    </section>
  )
}

function UserManagementSection({ api, getErrorMessage }: SectionProps) {
  const pageSize = 10
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [users, setUsers] = useState<DashboardUser[]>([])
  const [departments, setDepartments] = useState<ReferentialRecord[]>([])
  const [page, setPage] = useState(1)

  const [roleFilter, setRoleFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [departmentFilter, setDepartmentFilter] = useState<string>('')
  const [searchFilter, setSearchFilter] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [formState, setFormState] = useState<UserFormState>(defaultUserFormState)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadDepartments = useCallback(async () => {
    try {
      const payload = await api.get<ReferentialApi[] | PagedResponse<ReferentialApi>>('/api/admin/settings/departments')
      setDepartments(parseReferentialResponse(payload))
    } catch {
      setDepartments([])
    }
  }, [api])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', '1')
      params.set('limit', '200')

      if (roleFilter) {
        params.set('role', roleFilter)
      }

      if (statusFilter) {
        params.set('status', statusFilter)
      }

      if (departmentFilter) {
        params.set('department', departmentFilter)
      }

      if (searchFilter.trim()) {
        params.set('search', searchFilter.trim())
      }

      const payload = await api.get<PagedResponse<DashboardUserApi>>(`/api/users?${params.toString()}`)
      const mappedUsers = (payload.data ?? [])
        .map(mapUserApi)
        .filter((item): item is DashboardUser => item !== null)
        .filter((item) => !isAdminRole(item.role))

      setUsers(mappedUsers)
      setPage(1)
    } catch (error) {
      setError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [api, departmentFilter, getErrorMessage, roleFilter, searchFilter, statusFilter])

  useEffect(() => {
    void loadDepartments()
  }, [loadDepartments])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const pagedUsers = useMemo(() => {
    const start = (page - 1) * pageSize
    return users.slice(start, start + pageSize)
  }, [page, users])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(users.length / pageSize))
  }, [users.length])

  const openCreateModal = () => {
    setEditingUserId(null)
    setFormState(defaultUserFormState)
    setFormError(null)
    setModalOpen(true)
  }

  const openEditModal = (user: DashboardUser) => {
    setEditingUserId(user.id)
    setFormState({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      password: '',
      confirmPassword: '',
      role: adminManageableRoles.includes(user.role as ManageableRole)
        ? (user.role as ManageableRole)
        : 'manager',
      status: user.status,
      department: user.department,
    })
    setFormError(null)
    setModalOpen(true)
  }

  const validateForm = (): string | null => {
    if (!formState.firstName.trim() || !formState.lastName.trim()) {
      return 'First name and last name are required.'
    }

    if (!formState.email.trim()) {
      return 'Email is required.'
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email.trim())) {
      return 'Please enter a valid email address.'
    }

    if (!editingUserId) {
      if (!isStrongPassword(formState.password.trim())) {
        return 'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.'
      }

      if (formState.password !== formState.confirmPassword) {
        return 'Password confirmation does not match.'
      }
    }

    if (formState.password.trim() && formState.password !== formState.confirmPassword) {
      return 'Password confirmation does not match.'
    }

    return null
  }

  const saveUser = async () => {
    const validationError = validateForm()
    if (validationError) {
      setFormError(validationError)
      return
    }

    setSubmitting(true)
    setFormError(null)

    const payload: Record<string, string> = {
      firstName: formState.firstName.trim(),
      lastName: formState.lastName.trim(),
      email: formState.email.trim(),
      role: formState.role,
      status: formState.status,
      department: formState.department.trim(),
    }

    if (formState.password.trim()) {
      payload.password = formState.password.trim()
    }

    try {
      if (editingUserId) {
        await api.patch(`/api/users/${editingUserId}`, payload)
      } else {
        await api.post('/api/users', payload)
      }

      setModalOpen(false)
      setEditingUserId(null)
      setFormState(defaultUserFormState)
      await loadUsers()
    } catch (error) {
      setFormError(getErrorMessage(error))
    } finally {
      setSubmitting(false)
    }
  }

  const archiveUser = async (userId: string) => {
    if (!window.confirm('Archive this user account?')) {
      return
    }

    try {
      await api.patch(`/api/users/${userId}/archive`, {})
      await loadUsers()
    } catch (error) {
      setError(getErrorMessage(error))
    }
  }

  const deleteUser = async (userId: string) => {
    if (!window.confirm('Delete this user account? This action cannot be undone.')) {
      return
    }

    try {
      await api.del(`/api/users/${userId}`)
      await loadUsers()
    } catch (error) {
      setError(getErrorMessage(error))
    }
  }

  return (
    <section className="super-admin-section admin-view-section" id="section-users">
      <header className="section-header-row">
        <div className="section-header-text">
          <h2 className="section-title">User Management</h2>
          <p className="section-subtitle">
            Manage Manager, Supervisor, and Intern accounts. Admin and SuperAdmin users are intentionally hidden.
          </p>
        </div>
        <DashboardButton variant="primary" size="md" onClick={openCreateModal}>
          <Plus />
          <span>Create User</span>
        </DashboardButton>
      </header>

      <div className="filter-bar">
        <div className="filter-group">
          <select className="dash-input dash-select" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="">All Roles</option>
            <option value="manager">Manager</option>
            <option value="supervisor">Supervisor</option>
            <option value="intern">Intern</option>
          </select>

          <select className="dash-input dash-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All Statuses</option>
            {accountStatuses.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>

          <select
            className="dash-input dash-select"
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
          >
            <option value="">All Departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
        </div>

        <Input
          leftIcon={<Search />}
          placeholder="Search name or email"
          value={searchFilter}
          onChange={(event) => setSearchFilter(event.target.value)}
          className="search-input-component"
        />
      </div>

      {loading ? (
        <div className="skeleton-block">
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadUsers()} />
      ) : users.length === 0 ? (
        <div className="dash-empty">
          <h3 className="dash-empty-title">No users found</h3>
          <p className="dash-empty-description">No records match the selected filters.</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="dash-table super-admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="user-name-cell">
                      <div className="user-avatar">{user.fullName.charAt(0).toUpperCase()}</div>
                      <span>{user.fullName}</span>
                    </td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>
                      <span className={`dash-status-badge dash-status-badge-${user.status}`}>
                        {user.status}
                      </span>
                    </td>
                    <td>
                      <div className="table-row-actions">
                        <button
                          className="action-btn action-btn-edit"
                          onClick={() => openEditModal(user)}
                          aria-label="Edit user"
                          title="Edit user"
                        >
                          <Edit />
                        </button>
                        <button
                          className="action-btn action-btn-archive"
                          onClick={() => void archiveUser(user.id)}
                          aria-label="Archive user"
                          title="Archive user"
                        >
                          <Archive />
                        </button>
                        <button
                          className="action-btn action-btn-delete"
                          onClick={() => void deleteUser(user.id)}
                          aria-label="Delete user"
                          title="Delete user"
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="table-pagination">
              <DashboardButton variant="secondary" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                Previous
              </DashboardButton>
              <span className="pagination-info">Page {page} of {totalPages}</span>
              <DashboardButton
                variant="secondary"
                size="sm"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Next
              </DashboardButton>
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setFormError(null)
        }}
        title={editingUserId ? 'Edit User' : 'Create User'}
      >
        <form
          className="modal-form"
          onSubmit={(event) => {
            event.preventDefault()
            void saveUser()
          }}
        >
          <div className="admin-form-grid admin-form-grid-two">
            <div className="form-field">
              <label htmlFor="admin-user-first-name">First Name</label>
              <input
                id="admin-user-first-name"
                type="text"
                value={formState.firstName}
                onChange={(event) => setFormState((prev) => ({ ...prev, firstName: event.target.value }))}
              />
            </div>

            <div className="form-field">
              <label htmlFor="admin-user-last-name">Last Name</label>
              <input
                id="admin-user-last-name"
                type="text"
                value={formState.lastName}
                onChange={(event) => setFormState((prev) => ({ ...prev, lastName: event.target.value }))}
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="admin-user-email">Email</label>
            <input
              id="admin-user-email"
              type="email"
              value={formState.email}
              onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
            />
          </div>

          <div className="admin-form-grid admin-form-grid-two">
            <div className="form-field">
              <label htmlFor="admin-user-password">Password {editingUserId ? '(optional)' : ''}</label>
              <input
                id="admin-user-password"
                type="password"
                value={formState.password}
                onChange={(event) => setFormState((prev) => ({ ...prev, password: event.target.value }))}
              />
            </div>

            <div className="form-field">
              <label htmlFor="admin-user-password-confirm">Confirm Password</label>
              <input
                id="admin-user-password-confirm"
                type="password"
                value={formState.confirmPassword}
                onChange={(event) => setFormState((prev) => ({ ...prev, confirmPassword: event.target.value }))}
              />
            </div>
          </div>

          <div className="admin-form-grid admin-form-grid-three">
            <div className="form-field">
              <label htmlFor="admin-user-role">Role</label>
              <select
                id="admin-user-role"
                value={formState.role}
                onChange={(event) => setFormState((prev) => ({ ...prev, role: event.target.value as ManageableRole }))}
              >
                {adminManageableRoles.map((role) => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="admin-user-status">Status</label>
              <select
                id="admin-user-status"
                value={formState.status}
                onChange={(event) => setFormState((prev) => ({ ...prev, status: event.target.value as AccountStatus }))}
              >
                {accountStatuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="admin-user-department">Department</label>
              <select
                id="admin-user-department"
                value={formState.department}
                onChange={(event) => setFormState((prev) => ({ ...prev, department: event.target.value }))}
              >
                <option value="">Not assigned</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
            </div>
          </div>

          {formError && <p className="form-error">{formError}</p>}

          <div className="modal-actions">
            <DashboardButton variant="secondary" size="md" onClick={() => setModalOpen(false)} type="button">
              Cancel
            </DashboardButton>
            <DashboardButton variant="primary" size="md" loading={submitting} type="submit">
              {editingUserId ? 'Save User' : 'Create User'}
            </DashboardButton>
          </div>
        </form>
      </Modal>
    </section>
  )
}

function InternsSection({ api, getErrorMessage }: SectionProps) {
  const pageSize = 10
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [interns, setInterns] = useState<InternRecord[]>([])
  const [searchFilter, setSearchFilter] = useState('')
  const [page, setPage] = useState(1)

  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [selectedIntern, setSelectedIntern] = useState<InternRecord | null>(null)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)

  const loadInterns = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const payload = await api.get<PagedResponse<InternApi>>('/api/interns?limit=500')
      const mappedInterns = (payload.data ?? [])
        .map(mapInternApi)
        .filter((intern): intern is InternRecord => intern !== null)

      setInterns(mappedInterns)
      setPage(1)
    } catch (error) {
      setError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [api, getErrorMessage])

  useEffect(() => {
    void loadInterns()
  }, [loadInterns])

  const filteredInterns = useMemo(() => {
    const normalizedSearch = searchFilter.trim().toLowerCase()

    if (!normalizedSearch) {
      return interns
    }

    return interns.filter((intern) => {
      return (
        intern.fullName.toLowerCase().includes(normalizedSearch)
        || intern.email.toLowerCase().includes(normalizedSearch)
        || intern.accountStatus.toLowerCase().includes(normalizedSearch)
        || intern.verificationStatus.toLowerCase().includes(normalizedSearch)
      )
    })
  }, [interns, searchFilter])

  const pagedInterns = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredInterns.slice(start, start + pageSize)
  }, [filteredInterns, page])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredInterns.length / pageSize))
  }, [filteredInterns.length])

  const openInternDetails = async (internId: string) => {
    setDetailsLoading(true)
    setDetailsError(null)
    setDetailsModalOpen(true)

    try {
      const payload = await api.get<InternApi>(`/api/interns/${internId}`)
      const mappedIntern = mapInternApi(payload)

      if (!mappedIntern) {
        throw new Error('Unable to read intern details.')
      }

      setSelectedIntern(mappedIntern)
    } catch (error) {
      setDetailsError(getErrorMessage(error))
      setSelectedIntern(null)
    } finally {
      setDetailsLoading(false)
    }
  }

  return (
    <section className="super-admin-section admin-view-section" id="section-interns">
      <header className="section-header-row">
        <div className="section-header-text">
          <h2 className="section-title">Interns</h2>
          <p className="section-subtitle">Browse and inspect intern profiles across the platform.</p>
        </div>
      </header>

      <Input
        leftIcon={<Search />}
        placeholder="Search interns"
        value={searchFilter}
        onChange={(event) => setSearchFilter(event.target.value)}
        className="search-input-component"
      />

      {loading ? (
        <div className="skeleton-block">
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadInterns()} />
      ) : filteredInterns.length === 0 ? (
        <div className="dash-empty">
          <h3 className="dash-empty-title">No interns found</h3>
          <p className="dash-empty-description">No intern records match your search.</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="dash-table super-admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Account Status</th>
                  <th>Verification Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedInterns.map((intern) => (
                  <tr key={intern.id}>
                    <td>{intern.fullName}</td>
                    <td>{intern.email}</td>
                    <td>{intern.accountStatus}</td>
                    <td>{intern.verificationStatus}</td>
                    <td>
                      <button
                        className="dash-btn dash-btn-secondary dash-btn-sm"
                        onClick={() => void openInternDetails(intern.id)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="table-pagination">
              <DashboardButton variant="secondary" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                Previous
              </DashboardButton>
              <span className="pagination-info">Page {page} of {totalPages}</span>
              <DashboardButton
                variant="secondary"
                size="sm"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Next
              </DashboardButton>
            </div>
          )}
        </>
      )}

      <Modal isOpen={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} title="Intern Details">
        {detailsLoading ? (
          <Skeleton height="240px" />
        ) : detailsError ? (
          <ErrorState message={detailsError} onRetry={() => selectedIntern && void openInternDetails(selectedIntern.id)} />
        ) : selectedIntern ? (
          <div className="admin-modal-details-grid">
            <div>
              <h3>Name</h3>
              <p>{selectedIntern.fullName}</p>
            </div>
            <div>
              <h3>Email</h3>
              <p>{selectedIntern.email}</p>
            </div>
            <div>
              <h3>Account Status</h3>
              <p>{selectedIntern.accountStatus}</p>
            </div>
            <div>
              <h3>Verification Status</h3>
              <p>{selectedIntern.verificationStatus}</p>
            </div>
            <div>
              <h3>Start Date</h3>
              <p>{selectedIntern.startDate ? new Date(selectedIntern.startDate).toLocaleDateString() : '-'}</p>
            </div>
            <div>
              <h3>End Date</h3>
              <p>{selectedIntern.endDate ? new Date(selectedIntern.endDate).toLocaleDateString() : '-'}</p>
            </div>
            <div className="admin-modal-span-all">
              <h3>CV</h3>
              {selectedIntern.cvFileUrl ? (
                <a href={selectedIntern.cvFileUrl} target="_blank" rel="noreferrer">Open CV file</a>
              ) : (
                <p>No CV uploaded.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="dash-empty">
            <h3 className="dash-empty-title">No details available</h3>
          </div>
        )}
      </Modal>
    </section>
  )
}

function InternshipsSection({ api, getErrorMessage }: SectionProps) {
  const pageSize = 10
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [internships, setInternships] = useState<InternshipRecord[]>([])
  const [supervisors, setSupervisors] = useState<DashboardUser[]>([])
  const [departments, setDepartments] = useState<ReferentialRecord[]>([])
  const [types, setTypes] = useState<ReferentialRecord[]>([])

  const [searchFilter, setSearchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [page, setPage] = useState(1)

  const [formModalOpen, setFormModalOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [editingInternshipId, setEditingInternshipId] = useState<string | null>(null)
  const [formState, setFormState] = useState<InternshipFormState>(defaultInternshipFormState)

  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [detailsTab, setDetailsTab] = useState<InternshipDetailsTab>('details')
  const [selectedInternship, setSelectedInternship] = useState<InternshipRecord | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyItems, setHistoryItems] = useState<InternshipHistoryRecord[]>([])

  const loadReferenceData = useCallback(async () => {
    const [supervisorsPayload, departmentsPayload, typesPayload] = await Promise.all([
      api.get<PagedResponse<DashboardUserApi>>('/api/users?role=supervisor&page=1&limit=200'),
      api.get<ReferentialApi[] | PagedResponse<ReferentialApi>>('/api/admin/settings/departments'),
      api.get<ReferentialApi[] | PagedResponse<ReferentialApi>>('/api/admin/settings/internship-types'),
    ])

    const supervisorData = (supervisorsPayload.data ?? [])
      .map(mapUserApi)
      .filter((item): item is DashboardUser => item !== null)

    setSupervisors(supervisorData)
    setDepartments(parseReferentialResponse(departmentsPayload))
    setTypes(parseReferentialResponse(typesPayload))
  }, [api])

  const loadInternships = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', '1')
      params.set('limit', '250')

      if (statusFilter) {
        params.set('status', statusFilter)
      }

      if (departmentFilter) {
        params.set('department', departmentFilter)
      }

      const payload = await api.get<PagedResponse<InternshipApi>>(`/api/internships?${params.toString()}`)
      const mappedInternships = (payload.data ?? [])
        .map(mapInternshipApi)
        .filter((item): item is InternshipRecord => item !== null)

      setInternships(mappedInternships)
      setPage(1)
    } catch (error) {
      setError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [api, departmentFilter, getErrorMessage, statusFilter])

  useEffect(() => {
    void (async () => {
      try {
        await loadReferenceData()
      } catch {
        // Non-blocking for main table rendering.
      }
    })()
  }, [loadReferenceData])

  useEffect(() => {
    void loadInternships()
  }, [loadInternships])

  const filteredInternships = useMemo(() => {
    const normalizedSearch = searchFilter.trim().toLowerCase()

    return internships.filter((internship) => {
      if (normalizedSearch) {
        const matchesSearch =
          internship.missionTitle.toLowerCase().includes(normalizedSearch)
          || (internship.internName ?? '').toLowerCase().includes(normalizedSearch)
          || (internship.supervisorName ?? '').toLowerCase().includes(normalizedSearch)

        if (!matchesSearch) {
          return false
        }
      }

      if (typeFilter && (internship.type ?? '') !== typeFilter) {
        return false
      }

      if (startDateFilter && internship.startDate) {
        const internshipStart = new Date(internship.startDate)
        const filterStart = new Date(`${startDateFilter}T00:00:00.000Z`)
        if (internshipStart < filterStart) {
          return false
        }
      }

      if (endDateFilter && internship.endDate) {
        const internshipEnd = new Date(internship.endDate)
        const filterEnd = new Date(`${endDateFilter}T23:59:59.999Z`)
        if (internshipEnd > filterEnd) {
          return false
        }
      }

      return true
    })
  }, [endDateFilter, internships, searchFilter, startDateFilter, typeFilter])

  const pagedInternships = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredInternships.slice(start, start + pageSize)
  }, [filteredInternships, page])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredInternships.length / pageSize))
  }, [filteredInternships.length])

  const openCreateModal = () => {
    setEditingInternshipId(null)
    setFormState(defaultInternshipFormState)
    setFormError(null)
    setFormModalOpen(true)
  }

  const openEditModal = (internship: InternshipRecord) => {
    setEditingInternshipId(internship.id)
    setFormState({
      missionTitle: internship.missionTitle,
      supervisorId: internship.supervisorId,
      coSupervisorId: internship.coSupervisorId ?? '',
      department: internship.department ?? '',
      type: internship.type ?? '',
      status: internship.status,
      startDate: toDateInputValue(internship.startDate),
      endDate: toDateInputValue(internship.endDate),
      objectives: internship.objectives,
    })
    setFormError(null)
    setFormModalOpen(true)
  }

  const saveInternship = async () => {
    if (!formState.supervisorId.trim()) {
      setFormError('Supervisor is required.')
      return
    }

    if (!formState.startDate || !formState.endDate) {
      setFormError('Start date and end date are required.')
      return
    }

    if (new Date(formState.endDate) <= new Date(formState.startDate)) {
      setFormError('End date must be after start date.')
      return
    }

    setFormSubmitting(true)
    setFormError(null)

    const payload: Record<string, string> = {
      supervisorId: formState.supervisorId.trim(),
      coSupervisorId: formState.coSupervisorId.trim(),
      department: formState.department.trim(),
      type: formState.type.trim(),
      status: formState.status.trim(),
      startDate: toIsoDate(formState.startDate),
      endDate: toIsoDate(formState.endDate),
      objectives: formState.objectives.trim(),
    }

    try {
      if (editingInternshipId) {
        await api.patch(`/api/internships/${editingInternshipId}`, payload)
      } else {
        await api.post('/api/internships', payload)
      }

      setFormModalOpen(false)
      setEditingInternshipId(null)
      setFormState(defaultInternshipFormState)
      await loadInternships()
    } catch (error) {
      setFormError(getErrorMessage(error))
    } finally {
      setFormSubmitting(false)
    }
  }

  const deleteInternship = async (internshipId: string) => {
    if (!window.confirm('Delete this internship record?')) {
      return
    }

    try {
      await api.del(`/api/internships/${internshipId}`)
      await loadInternships()
    } catch (error) {
      setError(getErrorMessage(error))
    }
  }

  const loadHistory = useCallback(async (internshipId: string) => {
    setHistoryLoading(true)
    setHistoryError(null)

    try {
      const payload = await api.get<PagedResponse<InternshipHistoryApi>>(`/api/internships/${internshipId}/history?page=1&limit=50`)
      const mappedHistory = (payload.data ?? [])
        .map(mapHistoryApi)
        .filter((item): item is InternshipHistoryRecord => item !== null)
      setHistoryItems(mappedHistory)
    } catch (error) {
      setHistoryError(getErrorMessage(error))
      setHistoryItems([])
    } finally {
      setHistoryLoading(false)
    }
  }, [api, getErrorMessage])

  const openDetailsModal = (internship: InternshipRecord) => {
    setSelectedInternship(internship)
    setDetailsModalOpen(true)
    setDetailsTab('details')
    setHistoryItems([])
    setHistoryError(null)
  }

  useEffect(() => {
    if (!detailsModalOpen || detailsTab !== 'history' || !selectedInternship) {
      return
    }

    void loadHistory(selectedInternship.id)
  }, [detailsModalOpen, detailsTab, loadHistory, selectedInternship])

  return (
    <section className="super-admin-section admin-view-section" id="section-internships">
      <header className="section-header-row">
        <div className="section-header-text">
          <h2 className="section-title">Internships</h2>
          <p className="section-subtitle">Create, update, and track internship assignments with full history visibility.</p>
        </div>
        <DashboardButton variant="primary" size="md" onClick={openCreateModal}>
          <Plus />
          <span>Create Internship</span>
        </DashboardButton>
      </header>

      <div className="admin-toolbar admin-toolbar-grid">
        <Input
          leftIcon={<Search />}
          placeholder="Search by internship, intern, or supervisor"
          value={searchFilter}
          onChange={(event) => setSearchFilter(event.target.value)}
          className="search-input-component"
        />

        <select className="dash-input dash-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">All Statuses</option>
          <option value="template">template</option>
          <option value="active">active</option>
          <option value="completed">completed</option>
          <option value="cancelled">cancelled</option>
        </select>

        <select className="dash-input dash-select" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
          <option value="">All Departments</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>{department.name}</option>
          ))}
        </select>

        <select className="dash-input dash-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
          <option value="">All Types</option>
          {types.map((type) => (
            <option key={type.id} value={type.name}>{type.name}</option>
          ))}
        </select>

        <input
          className="dash-input"
          type="date"
          value={startDateFilter}
          onChange={(event) => setStartDateFilter(event.target.value)}
          aria-label="Start date"
        />
        <input
          className="dash-input"
          type="date"
          value={endDateFilter}
          onChange={(event) => setEndDateFilter(event.target.value)}
          aria-label="End date"
        />
      </div>

      {loading ? (
        <div className="skeleton-block">
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadInternships()} />
      ) : filteredInternships.length === 0 ? (
        <div className="dash-empty">
          <h3 className="dash-empty-title">No internships found</h3>
          <p className="dash-empty-description">No internship records match the active filters.</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="dash-table super-admin-table">
              <thead>
                <tr>
                  <th>Mission</th>
                  <th>Intern</th>
                  <th>Supervisor</th>
                  <th>Department</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedInternships.map((internship) => (
                  <tr key={internship.id}>
                    <td>
                      <button
                        className="admin-link-button"
                        onClick={() => openDetailsModal(internship)}
                      >
                        {internship.missionTitle}
                      </button>
                    </td>
                    <td>{internship.internName ?? '-'}</td>
                    <td>{internship.supervisorName ?? '-'}</td>
                    <td>{internship.department ?? '-'}</td>
                    <td>{internship.type ?? '-'}</td>
                    <td>{internship.status}</td>
                    <td>
                      <div className="table-row-actions">
                        <button
                          className="action-btn action-btn-edit"
                          onClick={() => openEditModal(internship)}
                          aria-label="Edit internship"
                          title="Edit internship"
                        >
                          <Edit />
                        </button>
                        <button
                          className="action-btn action-btn-delete"
                          onClick={() => void deleteInternship(internship.id)}
                          aria-label="Delete internship"
                          title="Delete internship"
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="table-pagination">
              <DashboardButton variant="secondary" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                Previous
              </DashboardButton>
              <span className="pagination-info">Page {page} of {totalPages}</span>
              <DashboardButton
                variant="secondary"
                size="sm"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Next
              </DashboardButton>
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        title={editingInternshipId ? 'Edit Internship' : 'Create Internship'}
      >
        <form
          className="modal-form"
          onSubmit={(event) => {
            event.preventDefault()
            void saveInternship()
          }}
        >
          <div className="form-field">
            <label htmlFor="internship-mission-title">Mission Title (optional)</label>
            <input
              id="internship-mission-title"
              type="text"
              value={formState.missionTitle}
              onChange={(event) => setFormState((prev) => ({ ...prev, missionTitle: event.target.value }))}
            />
          </div>

          <div className="admin-form-grid admin-form-grid-two">
            <div className="form-field">
              <label htmlFor="internship-supervisor">Supervisor</label>
              <select
                id="internship-supervisor"
                value={formState.supervisorId}
                onChange={(event) => setFormState((prev) => ({ ...prev, supervisorId: event.target.value }))}
              >
                <option value="">Select supervisor</option>
                {supervisors.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>{supervisor.fullName}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="internship-co-supervisor">Co-supervisor (optional)</label>
              <select
                id="internship-co-supervisor"
                value={formState.coSupervisorId}
                onChange={(event) => setFormState((prev) => ({ ...prev, coSupervisorId: event.target.value }))}
              >
                <option value="">None</option>
                {supervisors.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>{supervisor.fullName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="admin-form-grid admin-form-grid-three">
            <div className="form-field">
              <label htmlFor="internship-department">Department</label>
              <select
                id="internship-department"
                value={formState.department}
                onChange={(event) => setFormState((prev) => ({ ...prev, department: event.target.value }))}
              >
                <option value="">Not assigned</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="internship-type">Type</label>
              <select
                id="internship-type"
                value={formState.type}
                onChange={(event) => setFormState((prev) => ({ ...prev, type: event.target.value }))}
              >
                <option value="">Not assigned</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="internship-status">Status</label>
              <select
                id="internship-status"
                value={formState.status}
                onChange={(event) => setFormState((prev) => ({ ...prev, status: event.target.value }))}
              >
                <option value="template">template</option>
                <option value="active">active</option>
                <option value="completed">completed</option>
                <option value="cancelled">cancelled</option>
              </select>
            </div>
          </div>

          <div className="admin-form-grid admin-form-grid-two">
            <div className="form-field">
              <label htmlFor="internship-start-date">Start Date</label>
              <input
                id="internship-start-date"
                type="date"
                value={formState.startDate}
                onChange={(event) => setFormState((prev) => ({ ...prev, startDate: event.target.value }))}
              />
            </div>

            <div className="form-field">
              <label htmlFor="internship-end-date">End Date</label>
              <input
                id="internship-end-date"
                type="date"
                value={formState.endDate}
                onChange={(event) => setFormState((prev) => ({ ...prev, endDate: event.target.value }))}
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="internship-objectives">Objectives</label>
            <textarea
              id="internship-objectives"
              className="admin-textarea"
              value={formState.objectives}
              onChange={(event) => setFormState((prev) => ({ ...prev, objectives: event.target.value }))}
            />
          </div>

          {formError && <p className="form-error">{formError}</p>}

          <div className="modal-actions">
            <DashboardButton variant="secondary" size="md" onClick={() => setFormModalOpen(false)} type="button">
              Cancel
            </DashboardButton>
            <DashboardButton variant="primary" size="md" loading={formSubmitting} type="submit">
              {editingInternshipId ? 'Save Changes' : 'Create Internship'}
            </DashboardButton>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={selectedInternship ? `Internship: ${selectedInternship.missionTitle}` : 'Internship Details'}
      >
        {!selectedInternship ? (
          <div className="dash-empty">
            <h3 className="dash-empty-title">No details available</h3>
          </div>
        ) : (
          <div>
            <div className="admin-tab-row">
              <button
                className={`admin-tab-button ${detailsTab === 'details' ? 'is-active' : ''}`}
                onClick={() => setDetailsTab('details')}
                type="button"
              >
                Details
              </button>
              <button
                className={`admin-tab-button ${detailsTab === 'history' ? 'is-active' : ''}`}
                onClick={() => setDetailsTab('history')}
                type="button"
              >
                History
              </button>
            </div>

            {detailsTab === 'details' ? (
              <div className="admin-modal-details-grid">
                <div>
                  <h3>Mission</h3>
                  <p>{selectedInternship.missionTitle}</p>
                </div>
                <div>
                  <h3>Status</h3>
                  <p>{selectedInternship.status}</p>
                </div>
                <div>
                  <h3>Intern</h3>
                  <p>{selectedInternship.internName ?? '-'}</p>
                </div>
                <div>
                  <h3>Supervisor</h3>
                  <p>{selectedInternship.supervisorName ?? '-'}</p>
                </div>
                <div>
                  <h3>Department</h3>
                  <p>{selectedInternship.department ?? '-'}</p>
                </div>
                <div>
                  <h3>Type</h3>
                  <p>{selectedInternship.type ?? '-'}</p>
                </div>
                <div>
                  <h3>Start Date</h3>
                  <p>{selectedInternship.startDate ? new Date(selectedInternship.startDate).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <h3>End Date</h3>
                  <p>{selectedInternship.endDate ? new Date(selectedInternship.endDate).toLocaleDateString() : '-'}</p>
                </div>
                <div className="admin-modal-span-all">
                  <h3>Objectives</h3>
                  <p>{selectedInternship.objectives || '-'}</p>
                </div>
              </div>
            ) : historyLoading ? (
              <Skeleton height="220px" />
            ) : historyError ? (
              <ErrorState message={historyError} onRetry={() => void loadHistory(selectedInternship.id)} />
            ) : historyItems.length === 0 ? (
              <div className="dash-empty">
                <h3 className="dash-empty-title">No history records</h3>
                <p className="dash-empty-description">No change log entries are available for this internship.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="dash-table super-admin-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Old Value</th>
                      <th>New Value</th>
                      <th>Changed By</th>
                      <th>Changed At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyItems.map((item) => (
                      <tr key={item.id}>
                        <td>{item.field}</td>
                        <td>{item.oldValue || '-'}</td>
                        <td>{item.newValue || '-'}</td>
                        <td>{item.changedBy}</td>
                        <td>{item.changedAt ? new Date(item.changedAt).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </section>
  )
}

function EvaluationsSection({ api, getErrorMessage }: SectionProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  const [typeFilter, setTypeFilter] = useState('')
  const [supervisorFilter, setSupervisorFilter] = useState('')
  const [internFilter, setInternFilter] = useState('')

  const [supervisorOptions, setSupervisorOptions] = useState<DashboardUser[]>([])
  const [internOptions, setInternOptions] = useState<DashboardUser[]>([])

  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationRecord | null>(null)

  const loadUsers = useCallback(async () => {
    const [supervisorPayload, internPayload] = await Promise.all([
      api.get<PagedResponse<DashboardUserApi>>('/api/users?role=supervisor&page=1&limit=200'),
      api.get<PagedResponse<DashboardUserApi>>('/api/users?role=intern&page=1&limit=200'),
    ])

    setSupervisorOptions(
      (supervisorPayload.data ?? [])
        .map(mapUserApi)
        .filter((item): item is DashboardUser => item !== null),
    )

    setInternOptions(
      (internPayload.data ?? [])
        .map(mapUserApi)
        .filter((item): item is DashboardUser => item !== null),
    )
  }, [api])

  const loadEvaluations = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(pageSize))

      if (typeFilter) {
        params.set('type', typeFilter)
      }

      if (supervisorFilter) {
        params.set('supervisorId', supervisorFilter)
      }

      if (internFilter) {
        params.set('internId', internFilter)
      }

      const payload = await api.get<PagedResponse<EvaluationApi>>(`/api/evaluations?${params.toString()}`)
      const mappedEvaluations = (payload.data ?? [])
        .map(mapEvaluationApi)
        .filter((item): item is EvaluationRecord => item !== null)

      setEvaluations(mappedEvaluations)
      setTotal(payload.total ?? mappedEvaluations.length)
    } catch (error) {
      setError(getErrorMessage(error))
    } finally {
      setLoading(false)
    }
  }, [api, getErrorMessage, internFilter, page, pageSize, supervisorFilter, typeFilter])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  useEffect(() => {
    void loadEvaluations()
  }, [loadEvaluations])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / pageSize))
  }, [pageSize, total])

  return (
    <section className="super-admin-section admin-view-section" id="section-evaluations">
      <header className="section-header-row">
        <div className="section-header-text">
          <h2 className="section-title">Evaluations</h2>
          <p className="section-subtitle">Read-only list of platform evaluations with drill-down details.</p>
        </div>
      </header>

      <div className="admin-toolbar admin-toolbar-grid-three">
        <select className="dash-input dash-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
          <option value="">All Types</option>
          <option value="mid-term">mid-term</option>
          <option value="end">end</option>
        </select>

        <select
          className="dash-input dash-select"
          value={supervisorFilter}
          onChange={(event) => setSupervisorFilter(event.target.value)}
        >
          <option value="">All Supervisors</option>
          {supervisorOptions.map((user) => (
            <option key={user.id} value={user.id}>{user.fullName}</option>
          ))}
        </select>

        <select className="dash-input dash-select" value={internFilter} onChange={(event) => setInternFilter(event.target.value)}>
          <option value="">All Interns</option>
          {internOptions.map((user) => (
            <option key={user.id} value={user.id}>{user.fullName}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="skeleton-block">
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadEvaluations()} />
      ) : evaluations.length === 0 ? (
        <div className="dash-empty">
          <h3 className="dash-empty-title">No evaluations found</h3>
          <p className="dash-empty-description">No evaluations match the selected filters.</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="dash-table super-admin-table">
              <thead>
                <tr>
                  <th>Intern</th>
                  <th>Supervisor</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {evaluations.map((evaluation) => (
                  <tr key={evaluation.id}>
                    <td>{evaluation.internName}</td>
                    <td>{evaluation.supervisorName}</td>
                    <td>{evaluation.type}</td>
                    <td>{evaluation.status}</td>
                    <td>{evaluation.submittedAt ? new Date(evaluation.submittedAt).toLocaleString() : '-'}</td>
                    <td>
                      <button
                        className="dash-btn dash-btn-secondary dash-btn-sm"
                        onClick={() => setSelectedEvaluation(evaluation)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="table-pagination">
              <DashboardButton
                variant="secondary"
                size="sm"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
              >
                Previous
              </DashboardButton>
              <span className="pagination-info">Page {page} of {totalPages}</span>
              <DashboardButton
                variant="secondary"
                size="sm"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
              >
                Next
              </DashboardButton>
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={Boolean(selectedEvaluation)}
        onClose={() => setSelectedEvaluation(null)}
        title={selectedEvaluation ? `Evaluation - ${selectedEvaluation.internName}` : 'Evaluation Details'}
      >
        {selectedEvaluation ? (
          <div className="admin-modal-details-grid">
            <div>
              <h3>Intern</h3>
              <p>{selectedEvaluation.internName}</p>
            </div>
            <div>
              <h3>Supervisor</h3>
              <p>{selectedEvaluation.supervisorName}</p>
            </div>
            <div>
              <h3>Type</h3>
              <p>{selectedEvaluation.type}</p>
            </div>
            <div>
              <h3>Status</h3>
              <p>{selectedEvaluation.status}</p>
            </div>
            <div>
              <h3>Technical</h3>
              <p>{selectedEvaluation.technical}</p>
            </div>
            <div>
              <h3>Autonomy</h3>
              <p>{selectedEvaluation.autonomy}</p>
            </div>
            <div>
              <h3>Communication</h3>
              <p>{selectedEvaluation.communication}</p>
            </div>
            <div>
              <h3>Deadline Respect</h3>
              <p>{selectedEvaluation.deadlineRespect}</p>
            </div>
            <div>
              <h3>Deliverable Quality</h3>
              <p>{selectedEvaluation.deliverableQuality}</p>
            </div>
            <div className="admin-modal-span-all">
              <h3>Comments</h3>
              <p>{selectedEvaluation.comments || '-'}</p>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  )
}

function SettingsSection({ api, getErrorMessage }: SectionProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('departments')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<ReferentialRecord[]>([])
  const [saving, setSaving] = useState(false)

  const [inputValue, setInputValue] = useState('')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const payload = await api.get<ReferentialApi[] | PagedResponse<ReferentialApi>>(`/api/admin/settings/${activeTab}`)
      setItems(parseReferentialResponse(payload))
    } catch (error) {
      setError(getErrorMessage(error))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [activeTab, api, getErrorMessage])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  const saveItem = async () => {
    if (!inputValue.trim()) {
      return
    }

    setSaving(true)
    setError(null)

    try {
      if (editingItemId) {
        await api.patch(`/api/admin/settings/${activeTab}/${editingItemId}`, {
          name: inputValue.trim(),
        })
      } else {
        await api.post(`/api/admin/settings/${activeTab}`, {
          name: inputValue.trim(),
        })
      }

      setInputValue('')
      setEditingItemId(null)
      await loadItems()
    } catch (error) {
      setError(getErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const deleteItem = async (itemId: string) => {
    if (!window.confirm('Delete this entry?')) {
      return
    }

    try {
      await api.del(`/api/admin/settings/${activeTab}/${itemId}`)
      await loadItems()
    } catch (error) {
      setError(getErrorMessage(error))
    }
  }

  return (
    <section className="super-admin-section admin-view-section" id="section-settings">
      <header className="section-header-row">
        <div className="section-header-text">
          <h2 className="section-title">Referential Settings</h2>
          <p className="section-subtitle">Maintain departments, schools, internship types, skills, and verification statuses.</p>
        </div>
      </header>

      <div className="settings-tabs" role="tablist" aria-label="Settings tabs">
        {settingsTabs.map((tab) => (
          <button
            key={tab.id}
            className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id)
              setEditingItemId(null)
              setInputValue('')
            }}
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="admin-inline-editor">
        <input
          className="dash-input"
          type="text"
          placeholder="Enter name"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
        />
        <DashboardButton variant="primary" size="md" loading={saving} onClick={() => void saveItem()}>
          {editingItemId ? 'Save' : 'Add'}
        </DashboardButton>
        {editingItemId && (
          <DashboardButton
            variant="secondary"
            size="md"
            onClick={() => {
              setEditingItemId(null)
              setInputValue('')
            }}
          >
            Cancel
          </DashboardButton>
        )}
      </div>

      {loading ? (
        <div className="skeleton-block">
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadItems()} />
      ) : items.length === 0 ? (
        <div className="dash-empty">
          <h3 className="dash-empty-title">No entries configured</h3>
          <p className="dash-empty-description">Use the input above to add the first entry for this referential.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="dash-table super-admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>
                    <div className="table-row-actions">
                      <button
                        className="action-btn action-btn-edit"
                        onClick={() => {
                          setEditingItemId(item.id)
                          setInputValue(item.name)
                        }}
                        aria-label="Edit entry"
                        title="Edit entry"
                      >
                        <Edit />
                      </button>
                      <button
                        className="action-btn action-btn-delete"
                        onClick={() => void deleteItem(item.id)}
                        aria-label="Delete entry"
                        title="Delete entry"
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function AuditSection({ api, getErrorMessage }: SectionProps) {
  const pageSize = 20
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<AuditLogRecord[]>([])

  const [actorFilter, setActorFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [page, setPage] = useState(1)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', '1')
      params.set('limit', '200')

      if (actorFilter.trim()) {
        params.set('actor', actorFilter.trim())
      }

      if (actionFilter.trim()) {
        params.set('action', actionFilter.trim())
      }

      const payload = await api.get<PagedResponse<AuditLogApi>>(`/api/admin/audit-logs?${params.toString()}`)
      const mappedLogs = (payload.data ?? [])
        .map(mapAuditApi)
        .filter((item): item is AuditLogRecord => item !== null)

      setLogs(mappedLogs)
      setPage(1)
    } catch (error) {
      setError(getErrorMessage(error))
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [actionFilter, actorFilter, api, getErrorMessage])

  useEffect(() => {
    void loadLogs()
  }, [loadLogs])

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (entityFilter.trim() && !log.entity.toLowerCase().includes(entityFilter.trim().toLowerCase())) {
        return false
      }

      if (startDateFilter) {
        const startDate = new Date(`${startDateFilter}T00:00:00.000Z`)
        if (new Date(log.timestamp) < startDate) {
          return false
        }
      }

      if (endDateFilter) {
        const endDate = new Date(`${endDateFilter}T23:59:59.999Z`)
        if (new Date(log.timestamp) > endDate) {
          return false
        }
      }

      return true
    })
  }, [endDateFilter, entityFilter, logs, startDateFilter])

  const pagedLogs = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredLogs.slice(start, start + pageSize)
  }, [filteredLogs, page])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredLogs.length / pageSize))
  }, [filteredLogs.length])

  const exportCsv = () => {
    const rows: string[][] = [
      ['Actor', 'Action', 'Entity', 'Timestamp'],
      ...filteredLogs.map((log) => [
        log.actor,
        log.action,
        log.entity,
        new Date(log.timestamp).toISOString(),
      ]),
    ]

    triggerCsvDownload('audit-logs.csv', rows)
  }

  return (
    <section className="super-admin-section admin-view-section" id="section-audit">
      <header className="section-header-row">
        <div className="section-header-text">
          <h2 className="section-title">Audit Log</h2>
          <p className="section-subtitle">Filter audit logs by actor, action, entity, and date range.</p>
        </div>
        <DashboardButton variant="secondary" size="md" onClick={exportCsv}>
          <Download />
          <span>Export CSV</span>
        </DashboardButton>
      </header>

      <div className="admin-toolbar admin-toolbar-grid">
        <Input
          leftIcon={<Search />}
          placeholder="Filter by actor"
          value={actorFilter}
          onChange={(event) => setActorFilter(event.target.value)}
          className="search-input-component"
        />

        <Input
          leftIcon={<Filter />}
          placeholder="Filter by action"
          value={actionFilter}
          onChange={(event) => setActionFilter(event.target.value)}
          className="search-input-component"
        />

        <Input
          leftIcon={<Target />}
          placeholder="Filter by entity"
          value={entityFilter}
          onChange={(event) => setEntityFilter(event.target.value)}
          className="search-input-component"
        />

        <input
          className="dash-input"
          type="date"
          value={startDateFilter}
          onChange={(event) => setStartDateFilter(event.target.value)}
          aria-label="Start date"
        />

        <input
          className="dash-input"
          type="date"
          value={endDateFilter}
          onChange={(event) => setEndDateFilter(event.target.value)}
          aria-label="End date"
        />
      </div>

      {loading ? (
        <div className="skeleton-block">
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadLogs()} />
      ) : filteredLogs.length === 0 ? (
        <div className="dash-empty">
          <h3 className="dash-empty-title">No audit logs found</h3>
          <p className="dash-empty-description">No records match the current filter combination.</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="dash-table super-admin-table">
              <thead>
                <tr>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {pagedLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.actor}</td>
                    <td>{log.action}</td>
                    <td>{log.entity}</td>
                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="table-pagination">
              <DashboardButton variant="secondary" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                Previous
              </DashboardButton>
              <span className="pagination-info">Page {page} of {totalPages}</span>
              <DashboardButton
                variant="secondary"
                size="sm"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Next
              </DashboardButton>
            </div>
          )}
        </>
      )}
    </section>
  )
}

function NotificationsEmailSection({ getErrorMessage }: SectionProps) {
  const [loading, setLoading] = useState(true)
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [templateForm, setTemplateForm] = useState<EmailTemplateFormState>(defaultEmailTemplateFormState)

  const loadData = useCallback(async () => {
    setLoading(true)
    setBannerError(null)

    try {
      const [rulesPayload, templatesPayload] = await Promise.all([
        pendingAdminServices.listNotificationRules(),
        pendingAdminServices.listEmailTemplates(),
      ])

      setRules(rulesPayload)
      setTemplates(templatesPayload)
    } catch (error) {
      setBannerError(getErrorMessage(error))
      setRules([])
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [getErrorMessage])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const saveTemplate = async () => {
    try {
      await pendingAdminServices.saveEmailTemplate(templateForm)
    } catch (error) {
      setBannerError(getErrorMessage(error))
    }
  }

  return (
    <section className="super-admin-section admin-view-section" id="section-notification-email">
      <header className="section-header-row">
        <div className="section-header-text">
          <h2 className="section-title">Notification and Email Template Manager</h2>
          <p className="section-subtitle">Configure notification rules and email templates for platform events.</p>
        </div>
      </header>

      {bannerError && <div className="admin-inline-banner">{bannerError}</div>}

      <Panel title="Notification Rules" className="dash-panel-table">
        {loading ? (
          <Skeleton height="180px" />
        ) : rules.length === 0 ? (
          <div className="dash-empty">
            <h3 className="dash-empty-title">Endpoint not yet available</h3>
            <p className="dash-empty-description">Rules will appear here when notification-rules endpoints are implemented.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="dash-table super-admin-table">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Trigger</th>
                  <th>Enabled</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{rule.name}</td>
                    <td>{rule.trigger}</td>
                    <td>
                      <label className="admin-toggle">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => void pendingAdminServices.updateNotificationRule(rule.id, !rule.enabled)}
                        />
                        <span>Toggle</span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Email Templates"
        actions={(
          <DashboardButton variant="primary" size="sm" onClick={() => setTemplateModalOpen(true)}>
            <Edit />
            <span>Edit Template</span>
          </DashboardButton>
        )}
        className="dash-panel-table"
      >
        {loading ? (
          <Skeleton height="180px" />
        ) : templates.length === 0 ? (
          <div className="dash-empty">
            <h3 className="dash-empty-title">Endpoint not yet available</h3>
            <p className="dash-empty-description">Templates will appear when email-template endpoints are implemented.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="dash-table super-admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Subject</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td>{template.name}</td>
                    <td>{template.subject}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title="Edit Email Template"
      >
        <form
          className="modal-form"
          onSubmit={(event) => {
            event.preventDefault()
            void saveTemplate()
          }}
        >
          <div className="form-field">
            <label htmlFor="template-name">Template Name</label>
            <input
              id="template-name"
              type="text"
              value={templateForm.name}
              onChange={(event) => setTemplateForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="welcome_intern"
            />
          </div>

          <div className="form-field">
            <label htmlFor="template-subject">Subject</label>
            <input
              id="template-subject"
              type="text"
              value={templateForm.subject}
              onChange={(event) => setTemplateForm((prev) => ({ ...prev, subject: event.target.value }))}
              placeholder="Welcome {{firstName}}"
            />
          </div>

          <div className="form-field">
            <label htmlFor="template-body">Body (supports {'{{variable}}'} placeholders)</label>
            <textarea
              id="template-body"
              className="admin-textarea"
              value={templateForm.body}
              onChange={(event) => setTemplateForm((prev) => ({ ...prev, body: event.target.value }))}
            />
          </div>

          <div className="admin-preview-panel">
            <h3>Preview</h3>
            <pre>{templateForm.body || 'Template preview will appear here.'}</pre>
          </div>

          <div className="modal-actions">
            <DashboardButton variant="secondary" size="md" onClick={() => setTemplateModalOpen(false)} type="button">
              Close
            </DashboardButton>
            <DashboardButton
              variant="secondary"
              size="md"
              type="button"
              disabled
              title="Disabled until POST /api/admin/email-templates/test-send is implemented"
            >
              Test Send
            </DashboardButton>
            <DashboardButton variant="primary" size="md" type="submit">
              Save Template
            </DashboardButton>
          </div>
        </form>
      </Modal>
    </section>
  )
}

function ArchiveSection({ getErrorMessage }: SectionProps) {
  const [loading, setLoading] = useState(true)
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [history, setHistory] = useState<ArchiveHistoryRecord[]>([])

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setBannerError(null)

    try {
      const payload = await pendingAdminServices.listArchiveHistory()
      setHistory(payload)
    } catch (error) {
      setBannerError(getErrorMessage(error))
      setHistory([])
    } finally {
      setLoading(false)
    }
  }, [getErrorMessage])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const triggerArchive = async () => {
    const confirmed = window.confirm('Trigger annual archive now?')
    if (!confirmed) {
      return
    }

    try {
      await pendingAdminServices.triggerArchive()
    } catch (error) {
      setBannerError(getErrorMessage(error))
    }
  }

  return (
    <section className="super-admin-section admin-view-section" id="section-archive">
      <header className="section-header-row">
        <div className="section-header-text">
          <h2 className="section-title">Archive Manager</h2>
          <p className="section-subtitle">Trigger annual archive jobs and inspect archive history.</p>
        </div>
        <DashboardButton variant="primary" size="md" onClick={() => void triggerArchive()}>
          Trigger Annual Archive
        </DashboardButton>
      </header>

      {bannerError && <div className="admin-inline-banner">{bannerError}</div>}

      {loading ? (
        <Skeleton height="220px" />
      ) : history.length === 0 ? (
        <div className="dash-empty">
          <h3 className="dash-empty-title">Endpoint not yet available</h3>
          <p className="dash-empty-description">Archive history will appear when archive endpoints are implemented.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="dash-table super-admin-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Triggered By</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{item.year}</td>
                  <td>{item.triggeredBy}</td>
                  <td>{new Date(item.triggeredAt).toLocaleString()}</td>
                  <td>{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function BiAccessSection({ getErrorMessage }: SectionProps) {
  const [loading, setLoading] = useState(true)
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [matrix, setMatrix] = useState<BiAccessMatrix[]>([])

  const createDefaultMatrix = (): BiAccessMatrix[] => {
    return roleRows.map((role) => {
      return {
        role,
        dashboards: dashboardColumns.reduce<Record<string, boolean>>((accumulator, dashboard) => {
          accumulator[dashboard] = false
          return accumulator
        }, {}),
      }
    })
  }

  const loadMatrix = useCallback(async () => {
    setLoading(true)
    setBannerError(null)

    try {
      const payload = await pendingAdminServices.listBiAccessMatrix()
      setMatrix(payload)
    } catch (error) {
      setBannerError(getErrorMessage(error))
      setMatrix(createDefaultMatrix())
    } finally {
      setLoading(false)
    }
  }, [getErrorMessage])

  useEffect(() => {
    void loadMatrix()
  }, [loadMatrix])

  const toggleCell = (role: string, dashboard: string) => {
    setMatrix((prev) => {
      return prev.map((row) => {
        if (row.role !== role) {
          return row
        }

        return {
          ...row,
          dashboards: {
            ...row.dashboards,
            [dashboard]: !row.dashboards[dashboard],
          },
        }
      })
    })
  }

  const saveMatrix = async () => {
    try {
      await pendingAdminServices.saveBiAccessMatrix(matrix)
    } catch (error) {
      setBannerError(getErrorMessage(error))
    }
  }

  return (
    <section className="super-admin-section admin-view-section" id="section-bi-access">
      <header className="section-header-row">
        <div className="section-header-text">
          <h2 className="section-title">BI Access Control</h2>
          <p className="section-subtitle">Manage dashboard access grants by role using a permission matrix.</p>
        </div>
        <DashboardButton variant="primary" size="md" onClick={() => void saveMatrix()}>
          Save Access Matrix
        </DashboardButton>
      </header>

      {bannerError && <div className="admin-inline-banner">{bannerError}</div>}

      {loading ? (
        <Skeleton height="260px" />
      ) : matrix.length === 0 ? (
        <div className="dash-empty">
          <h3 className="dash-empty-title">No matrix data available</h3>
          <p className="dash-empty-description">Matrix data will be available when BI access endpoints are implemented.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="dash-table super-admin-table">
            <thead>
              <tr>
                <th>Role</th>
                {dashboardColumns.map((dashboard) => (
                  <th key={dashboard}>{dashboard}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.role}>
                  <td>{row.role}</td>
                  {dashboardColumns.map((dashboard) => (
                    <td key={`${row.role}-${dashboard}`}>
                      <label className="admin-toggle">
                        <input
                          type="checkbox"
                          checked={Boolean(row.dashboards[dashboard])}
                          onChange={() => toggleCell(row.role, dashboard)}
                          title="Local toggle only until /api/admin/bi-access is implemented"
                        />
                        <span>{row.dashboards[dashboard] ? 'Granted' : 'Blocked'}</span>
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export function AdminDashboard() {
  const api = useDashboardApi()
  const location = useLocation()
  const navigate = useNavigate()

  const getErrorMessage = useCallback((error: unknown): string => {
    if (error instanceof Error && error.message.trim()) {
      return error.message
    }

    return 'Unable to complete the request. Please retry.'
  }, [])

  useEffect(() => {
    if (location.pathname === '/dashboard') {
      navigate('/dashboard/admin', { replace: true })
    }
  }, [location.pathname, navigate])

  const activeView = useMemo(() => resolveAdminView(location.pathname), [location.pathname])
  const activeSection = sectionByView[activeView]

  const pageTitle = useMemo(() => {
    switch (activeView) {
      case 'overview':
        return 'Admin Dashboard'
      case 'users':
        return 'User Management'
      case 'interns':
        return 'Interns'
      case 'internships':
        return 'Internships'
      case 'evaluations':
        return 'Evaluations'
      case 'settings':
        return 'Referential Settings'
      case 'audit':
        return 'Audit Log'
      case 'notificationsEmail':
        return 'Notification and Email Templates'
      case 'archive':
        return 'Archive Manager'
      case 'biAccess':
        return 'BI Access Control'
      default:
        return 'Admin Dashboard'
    }
  }, [activeView])

  const handleSectionChange = useCallback((section: SuperAdminSection) => {
    navigate(sectionPathMap[section])
  }, [navigate])

  const renderView = () => {
    const sectionProps: SectionProps = { api, getErrorMessage }

    switch (activeView) {
      case 'overview':
        return <OverviewSection {...sectionProps} />
      case 'users':
        return <UserManagementSection {...sectionProps} />
      case 'interns':
        return <InternsSection {...sectionProps} />
      case 'internships':
        return <InternshipsSection {...sectionProps} />
      case 'evaluations':
        return <EvaluationsSection {...sectionProps} />
      case 'settings':
        return <SettingsSection {...sectionProps} />
      case 'audit':
        return <AuditSection {...sectionProps} />
      case 'notificationsEmail':
        return <NotificationsEmailSection {...sectionProps} />
      case 'archive':
        return <ArchiveSection {...sectionProps} />
      case 'biAccess':
        return <BiAccessSection {...sectionProps} />
      default:
        return <OverviewSection {...sectionProps} />
    }
  }

  return (
    <div className="super-admin-dashboard admin-dashboard">
      <SuperAdminSidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
      />

      <main className="super-admin-main" id="main-content">
        <div className="super-admin-content-wrapper">
          <h1 className="page-title">{pageTitle}</h1>
          <div className="content-fade-in" key={location.pathname}>{renderView()}</div>
        </div>
      </main>
    </div>
  )
}

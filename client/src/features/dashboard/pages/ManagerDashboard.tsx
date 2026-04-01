import { useState, useEffect, useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { useDashboardApi } from '../hooks/useDashboardApi'
import { DashboardLayout } from '../components/DashboardLayout'
import { StatCard } from '../components/StatCard'
import { Panel } from '../components/Panel'
import { DashboardButton } from '../components/DashboardButton'
import { Skeleton } from '../components/Skeleton'
import { ErrorState } from '../components/ErrorState'
import { Modal } from '../components/Modal'
import '../styles/dashboard.css'
import './ManagerDashboard.css'

interface Intern {
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

interface Supervisor {
  id: string
  name: string
  email: string
  department?: string
  activeInternsCount: number
}

interface Department {
  id: string
  name: string
  internCount: number
  supervisorCount: number
  avgProgress: number
}

interface Activity {
  id: string
  type: 'submission' | 'evaluation' | 'mission_created' | 'meeting'
  actor: string
  description: string
  timestamp: string
}

interface PagedResponse<T> {
  data?: T[]
  total?: number
  page?: number
  limit?: number
}

interface UserRecord {
  id?: string
  name?: string
  firstName?: string
  lastName?: string
  email?: string
  department?: string
  status?: string
}

interface InternshipRecord {
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

interface AuditLogRecord {
  id?: string
  actor?: string
  action?: string
  timestamp?: string
  createdAt?: string
  description?: string
}

interface DepartmentRecord {
  id?: string
  name?: string
}

function asNonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function resolveUserName(user: UserRecord): string {
  const name = asNonEmptyString(user.name)
  if (name) return name

  const firstName = asNonEmptyString(user.firstName)
  const lastName = asNonEmptyString(user.lastName)
  const fullName = `${firstName} ${lastName}`.trim()
  if (fullName) return fullName

  return asNonEmptyString(user.email) || 'Unknown'
}

function readNumericValue(payload: unknown): number {
  if (typeof payload === 'number') return payload
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>
    for (const key of ['count', 'value', 'total']) {
      const candidate = record[key]
      if (typeof candidate === 'number') return candidate
    }
  }
  return 0
}

function normalizeInternStatus(statusValue: string): Intern['status'] {
  const status = statusValue.trim().toLowerCase()
  if (status === 'completed' || status === 'done' || status === 'finished') return 'completed'
  if (status === 'pending' || status === 'awaiting' || status === 'not_started') return 'pending'
  return 'active'
}

function estimateProgress(startDate?: string, endDate?: string, statusValue?: string): number {
  if (normalizeInternStatus(statusValue ?? '') === 'completed') return 100

  const start = startDate ? Date.parse(startDate) : NaN
  const end = endDate ? Date.parse(endDate) : NaN
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0

  const now = Date.now()
  if (now <= start) return 0
  if (now >= end) return 100

  return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)))
}

function inferActivityType(action: string): Activity['type'] {
  const normalized = action.toLowerCase()
  if (normalized.includes('deliverable') || normalized.includes('submit')) return 'submission'
  if (normalized.includes('evaluation')) return 'evaluation'
  if (normalized.includes('mission')) return 'mission_created'
  return 'meeting'
}

export function ManagerDashboard() {
  const { t } = useI18n()
  const api = useDashboardApi()

  // Loading states
  const [loadingKPIs, setLoadingKPIs] = useState(true)
  const [loadingInterns, setLoadingInterns] = useState(true)
  const [loadingSupervisors, setLoadingSupervisors] = useState(true)
  const [loadingDepartments, setLoadingDepartments] = useState(true)
  const [loadingActivity, setLoadingActivity] = useState(true)

  // Error states
  const [kpisError, setKpisError] = useState<string | null>(null)
  const [internsError, setInternsError] = useState<string | null>(null)
  const [supervisorsError, setSupervisorsError] = useState<string | null>(null)
  const [departmentsError, setDepartmentsError] = useState<string | null>(null)
  const [activityError, setActivityError] = useState<string | null>(null)

  // Data states
  const [internsCount, setInternsCount] = useState(0)
  const [activeMissionsCount, setActiveMissionsCount] = useState(0)
  const [avgCompletion, setAvgCompletion] = useState(0)
  const [pendingReviews, setPendingReviews] = useState(0)
  const [interns, setInterns] = useState<Intern[]>([])
  const [supervisors, setSupervisors] = useState<Supervisor[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [activities, setActivities] = useState<Activity[]>([])

  // Filter states
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')
  const [internsSearch, setInternsSearch] = useState('')
  const [activeTab, setActiveTab] = useState('overview')

  // Modal states
  const [selectedIntern, setSelectedIntern] = useState<Intern | null>(null)
  const [isInternModalOpen, setIsInternModalOpen] = useState(false)

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message.trim()) return error.message
    return t('dashboard.error.load') || 'Failed to load'
  }

  const loadKPIs = async () => {
    setLoadingKPIs(true)
    setKpisError(null)

    try {
      const [internsCountPayload, missionsPayload, pendingPayload, internshipsPayload] = await Promise.all([
        api.get<{ count?: number } | number>('/api/stats/interns/count'),
        api.get<{ count?: number } | number>('/api/stats/missions'),
        api.get<{ count?: number } | number>('/api/stats/deliverables/pending'),
        api.get<PagedResponse<InternshipRecord>>('/api/internships?page=1&limit=200'),
      ])

      const internshipsData = internshipsPayload.data ?? []
      const completedInternships = internshipsData.filter((item) => asNonEmptyString(item.status).toLowerCase() === 'completed').length
      const completionPercent = internshipsData.length > 0 ? Math.round((completedInternships / internshipsData.length) * 100) : 0

      setInternsCount(readNumericValue(internsCountPayload))
      setActiveMissionsCount(readNumericValue(missionsPayload))
      setAvgCompletion(completionPercent)
      setPendingReviews(readNumericValue(pendingPayload))
    } catch (error) {
      setKpisError(getErrorMessage(error))
    } finally {
      setLoadingKPIs(false)
    }
  }

  const loadInterns = async () => {
    setLoadingInterns(true)
    setInternsError(null)

    try {
      const [internUsersPayload, internshipsPayload] = await Promise.all([
        api.get<PagedResponse<UserRecord>>('/api/users?role=intern&page=1&limit=100'),
        api.get<PagedResponse<InternshipRecord>>('/api/internships?page=1&limit=200'),
      ])

      const internshipsByInternId = new Map<string, InternshipRecord>()
      for (const internship of internshipsPayload.data ?? []) {
        const internId = asNonEmptyString(internship.internId)
        if (internId) internshipsByInternId.set(internId, internship)
      }

      const mappedInterns: Intern[] = (internUsersPayload.data ?? [])
        .map((user): Intern | null => {
          const userId = asNonEmptyString(user.id)
          if (!userId) return null

          const internship = internshipsByInternId.get(userId)
          const statusSource = asNonEmptyString(internship?.status) || asNonEmptyString(user.status)

          return {
            id: userId,
            name: resolveUserName(user),
            email: asNonEmptyString(user.email),
            department: asNonEmptyString(user.department) || asNonEmptyString(internship?.department) || undefined,
            missionTitle: asNonEmptyString(internship?.missionTitle) || undefined,
            supervisorName: asNonEmptyString(internship?.supervisorName) || undefined,
            startDate: asNonEmptyString(internship?.startDate) || undefined,
            endDate: asNonEmptyString(internship?.endDate) || undefined,
            progress: estimateProgress(internship?.startDate, internship?.endDate, statusSource),
            status: normalizeInternStatus(statusSource),
          }
        })
        .filter((intern): intern is Intern => intern !== null)

      setInterns(mappedInterns)
    } catch (error) {
      setInternsError(getErrorMessage(error))
    } finally {
      setLoadingInterns(false)
    }
  }

  const loadSupervisors = async () => {
    setLoadingSupervisors(true)
    setSupervisorsError(null)

    try {
      const [supervisorUsersPayload, internshipsPayload] = await Promise.all([
        api.get<PagedResponse<UserRecord>>('/api/users?role=supervisor&page=1&limit=100'),
        api.get<PagedResponse<InternshipRecord>>('/api/internships?page=1&limit=200'),
      ])

      const activeInternsBySupervisorId = new Map<string, number>()
      for (const internship of internshipsPayload.data ?? []) {
        const supervisorId = asNonEmptyString(internship.supervisorId)
        const internshipStatus = normalizeInternStatus(asNonEmptyString(internship.status))
        if (!supervisorId || internshipStatus === 'completed') continue
        activeInternsBySupervisorId.set(supervisorId, (activeInternsBySupervisorId.get(supervisorId) ?? 0) + 1)
      }

      const mappedSupervisors: Supervisor[] = (supervisorUsersPayload.data ?? [])
        .map((user): Supervisor | null => {
          const userId = asNonEmptyString(user.id)
          if (!userId) return null

          return {
            id: userId,
            name: resolveUserName(user),
            email: asNonEmptyString(user.email),
            department: asNonEmptyString(user.department) || undefined,
            activeInternsCount: activeInternsBySupervisorId.get(userId) ?? 0,
          }
        })
        .filter((supervisor): supervisor is Supervisor => supervisor !== null)

      setSupervisors(mappedSupervisors)
    } catch (error) {
      setSupervisorsError(getErrorMessage(error))
    } finally {
      setLoadingSupervisors(false)
    }
  }

  const loadDepartments = async () => {
    setLoadingDepartments(true)
    setDepartmentsError(null)

    try {
      const [departmentPayload, internUsersPayload, supervisorUsersPayload, internshipsPayload] = await Promise.all([
        api.get<DepartmentRecord[]>('/api/admin/settings/departments'),
        api.get<PagedResponse<UserRecord>>('/api/users?role=intern&page=1&limit=200'),
        api.get<PagedResponse<UserRecord>>('/api/users?role=supervisor&page=1&limit=200'),
        api.get<PagedResponse<InternshipRecord>>('/api/internships?page=1&limit=200'),
      ])

      const progressByDepartment = new Map<string, number[]>()
      for (const internship of internshipsPayload.data ?? []) {
        const departmentName = asNonEmptyString(internship.department)
        if (!departmentName) continue

        const progress = estimateProgress(internship.startDate, internship.endDate, internship.status)
        const current = progressByDepartment.get(departmentName) ?? []
        current.push(progress)
        progressByDepartment.set(departmentName, current)
      }

      const mappedDepartments: Department[] = (departmentPayload ?? [])
        .map((department): Department | null => {
          const name = asNonEmptyString(department.name)
          const id = asNonEmptyString(department.id)
          if (!name || !id) return null

          const internCount = (internUsersPayload.data ?? []).filter((user) => asNonEmptyString(user.department) === name).length
          const supervisorCount = (supervisorUsersPayload.data ?? []).filter((user) => asNonEmptyString(user.department) === name).length
          const progressValues = progressByDepartment.get(name) ?? []
          const avgProgress = progressValues.length > 0 ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length) : 0

          return { id, name, internCount, supervisorCount, avgProgress }
        })
        .filter((department): department is Department => department !== null)

      setDepartments(mappedDepartments)
    } catch (error) {
      setDepartmentsError(getErrorMessage(error))
    } finally {
      setLoadingDepartments(false)
    }
  }

  const loadActivity = async () => {
    setLoadingActivity(true)
    setActivityError(null)

    try {
      const activityPayload = await api.get<PagedResponse<AuditLogRecord>>('/api/admin/audit-logs?limit=10')

      const mappedActivities: Activity[] = (activityPayload.data ?? [])
        .map((log, index): Activity | null => {
          const action = asNonEmptyString(log.action) || asNonEmptyString(log.description)
          if (!action) return null

          const timestamp = asNonEmptyString(log.timestamp) || asNonEmptyString(log.createdAt)

          return {
            id: asNonEmptyString(log.id) || `${timestamp || 'activity'}-${index}`,
            type: inferActivityType(action),
            actor: asNonEmptyString(log.actor) || 'System',
            description: action,
            timestamp: timestamp || new Date().toISOString(),
          }
        })
        .filter((activity): activity is Activity => activity !== null)

      setActivities(mappedActivities)
    } catch (error) {
      setActivityError(getErrorMessage(error))
    } finally {
      setLoadingActivity(false)
    }
  }

  useEffect(() => {
    void loadKPIs()
    void loadInterns()
    void loadSupervisors()
    void loadDepartments()
    void loadActivity()
  }, [])

  const refreshAll = () => {
    void loadKPIs()
    void loadInterns()
    void loadSupervisors()
    void loadDepartments()
    void loadActivity()
  }

  const filteredInterns = useMemo(() => {
    return interns.filter((intern) => {
      const matchesDepartment = selectedDepartment === 'all' || intern.department === selectedDepartment
      const matchesSearch = intern.name.toLowerCase().includes(internsSearch.toLowerCase()) ||
        intern.email.toLowerCase().includes(internsSearch.toLowerCase())
      return matchesDepartment && matchesSearch
    })
  }, [interns, selectedDepartment, internsSearch])

  const departmentOptions = useMemo(() => {
    const deps = new Set(interns.map((i) => i.department).filter(Boolean))
    return ['all', ...Array.from(deps)]
  }, [interns])

  const openInternModal = (intern: Intern) => {
    setSelectedIntern(intern)
    setIsInternModalOpen(true)
  }

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'submission': return '↑'
      case 'evaluation': return '✓'
      case 'mission_created': return '⌘'
      case 'meeting': return '○'
      default: return '•'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
  }

  const getInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()

  const navItems = [
    { id: 'overview', label: 'Overview', icon: 'overview' as const },
    { id: 'interns', label: 'Interns', icon: 'interns' as const, badge: interns.length },
    { id: 'supervisors', label: 'Supervisors', icon: 'supervisors' as const, badge: supervisors.length },
    { id: 'departments', label: 'Departments', icon: 'departments' as const, badge: departments.length },
  ]

  return (
    <DashboardLayout
      title="Manager Dashboard"
      subtitle="Overview of internship program across departments"
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onRefresh={refreshAll}
      headerActions={
        <DashboardButton variant="secondary" size="sm" onClick={refreshAll}>
          Refresh
        </DashboardButton>
      }
    >
      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="dash-section" role="tabpanel" id="tabpanel-overview" aria-labelledby="tab-overview">
          {/* KPI Cards */}
          <div className="dash-stats-row">
            {loadingKPIs ? (
              <>
                <Skeleton height="120px" />
                <Skeleton height="120px" />
                <Skeleton height="120px" />
                <Skeleton height="120px" />
              </>
            ) : kpisError ? (
              <ErrorState message={kpisError} onRetry={loadKPIs} />
            ) : (
              <>
                <StatCard label="Total interns" value={internsCount.toLocaleString()} />
                <StatCard label="Active missions" value={activeMissionsCount.toLocaleString()} />
                <StatCard label="Avg completion" value={`${avgCompletion}%`} />
                <StatCard label="Pending reviews" value={pendingReviews.toLocaleString()} />
              </>
            )}
          </div>

          {/* Two Columns: Department Progress & Activity */}
          <div className="dash-two-cols">
            <Panel title="Department progress">
              {loadingDepartments ? (
                <Skeleton height="200px" />
              ) : departmentsError ? (
                <ErrorState message={departmentsError} onRetry={loadDepartments} />
              ) : departments.length === 0 ? (
                <div className="dash-empty">
                  <div className="dash-empty-icon">∅</div>
                  <h3 className="dash-empty-title">No departments</h3>
                  <p className="dash-empty-description">No departments configured yet.</p>
                </div>
              ) : (
                <div className="dept-list">
                  {departments.map((dept) => (
                    <div key={dept.id} className="dept-item">
                      <div className="dept-info">
                        <span className="dept-name">{dept.name}</span>
                        <span className="dept-meta">{dept.internCount} interns, {dept.supervisorCount} supervisors</span>
                      </div>
                      <div className="dept-progress">
                        <div className="dash-progress">
                          <div className="dash-progress-fill" style={{ width: `${dept.avgProgress}%` }} />
                        </div>
                        <span className="dept-progress-value">{dept.avgProgress}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Recent activity">
              {loadingActivity ? (
                <Skeleton height="200px" />
              ) : activityError ? (
                <ErrorState message={activityError} onRetry={loadActivity} />
              ) : activities.length === 0 ? (
                <div className="dash-empty">
                  <div className="dash-empty-icon">⟳</div>
                  <h3 className="dash-empty-title">No recent activity</h3>
                  <p className="dash-empty-description">Activity logs will appear here.</p>
                </div>
              ) : (
                <div className="activity-list">
                  {activities.map((activity) => (
                    <div key={activity.id} className="activity-item">
                      <span className={`activity-icon activity-icon-${activity.type}`} aria-hidden="true">
                        {getActivityIcon(activity.type)}
                      </span>
                      <div className="activity-content">
                        <p className="activity-description">
                          <strong>{activity.actor}</strong> {activity.description}
                        </p>
                        <span className="activity-time">{formatDate(activity.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>
      )}

      {/* Interns Tab */}
      {activeTab === 'interns' && (
        <div className="dash-section" role="tabpanel" id="tabpanel-interns" aria-labelledby="tab-interns">
          <Panel
            title="Interns"
            actions={
              <div className="dash-filter-row">
                <input
                  type="text"
                  placeholder="Search by name or email"
                  value={internsSearch}
                  onChange={(e) => setInternsSearch(e.target.value)}
                  className="dash-input"
                  style={{ width: '240px' }}
                />
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="dash-input dash-select"
                >
                  <option value="all">All departments</option>
                  {departmentOptions.filter((d) => d !== 'all').map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
            }
            className="dash-panel-table"
          >
            {loadingInterns ? (
              <Skeleton height="400px" />
            ) : internsError ? (
              <ErrorState message={internsError} onRetry={loadInterns} />
            ) : filteredInterns.length === 0 ? (
              <div className="dash-empty">
                <div className="dash-empty-icon">∅</div>
                <h3 className="dash-empty-title">No interns found</h3>
                <p className="dash-empty-description">Try adjusting your filters.</p>
              </div>
            ) : (
              <div className="dash-table-wrapper">
                <table className="dash-table dash-table-to-cards">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Department</th>
                      <th>Mission</th>
                      <th>Supervisor</th>
                      <th>Progress</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInterns.map((intern) => (
                      <tr key={intern.id}>
                        <td data-label="Name">
                          <div className="intern-cell">
                            <span className="intern-avatar" aria-hidden="true">{getInitials(intern.name)}</span>
                            <div className="intern-info">
                              <span className="intern-name">{intern.name}</span>
                              <span className="intern-email">{intern.email}</span>
                            </div>
                          </div>
                        </td>
                        <td data-label="Department">{intern.department || '-'}</td>
                        <td data-label="Mission">{intern.missionTitle || '-'}</td>
                        <td data-label="Supervisor">{intern.supervisorName || '-'}</td>
                        <td data-label="Progress">
                          <div className="table-progress">
                            <div className="dash-progress">
                              <div
                                className={`dash-progress-fill ${intern.status === 'completed' ? 'dash-progress-fill-success' : ''}`}
                                style={{ width: `${intern.progress}%` }}
                              />
                            </div>
                            <span>{intern.progress}%</span>
                          </div>
                        </td>
                        <td data-label="Status">
                          <span className={`dash-status-badge dash-status-badge-${intern.status}`}>{intern.status}</span>
                        </td>
                        <td data-label="Actions">
                          <button
                            className="view-button"
                            onClick={() => openInternModal(intern)}
                            aria-label={`View details for ${intern.name}`}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* Supervisors Tab */}
      {activeTab === 'supervisors' && (
        <div className="dash-section" role="tabpanel" id="tabpanel-supervisors" aria-labelledby="tab-supervisors">
          <Panel title="Supervisors">
            {loadingSupervisors ? (
              <div className="dash-grid dash-grid-auto">
                <Skeleton height="120px" />
                <Skeleton height="120px" />
                <Skeleton height="120px" />
              </div>
            ) : supervisorsError ? (
              <ErrorState message={supervisorsError} onRetry={loadSupervisors} />
            ) : supervisors.length === 0 ? (
              <div className="dash-empty">
                <div className="dash-empty-icon">∅</div>
                <h3 className="dash-empty-title">No supervisors</h3>
                <p className="dash-empty-description">No supervisors have been assigned yet.</p>
              </div>
            ) : (
              <div className="dash-grid dash-grid-3">
                {supervisors.map((supervisor) => (
                  <div key={supervisor.id} className="supervisor-card">
                    <div className="supervisor-header">
                      <span className="supervisor-avatar" aria-hidden="true">{getInitials(supervisor.name)}</span>
                      <div className="supervisor-meta">
                        <span className="supervisor-name">{supervisor.name}</span>
                        <span className="supervisor-department">{supervisor.department || 'No department'}</span>
                      </div>
                    </div>
                    <div className="supervisor-stats">
                      <div className="supervisor-stat">
                        <span className="supervisor-stat-value">{supervisor.activeInternsCount}</span>
                        <span className="supervisor-stat-label">Active interns</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* Departments Tab */}
      {activeTab === 'departments' && (
        <div className="dash-section" role="tabpanel" id="tabpanel-departments" aria-labelledby="tab-departments">
          <Panel title="Departments">
            {loadingDepartments ? (
              <div className="dash-grid dash-grid-3">
                <Skeleton height="160px" />
                <Skeleton height="160px" />
                <Skeleton height="160px" />
              </div>
            ) : departmentsError ? (
              <ErrorState message={departmentsError} onRetry={loadDepartments} />
            ) : departments.length === 0 ? (
              <div className="dash-empty">
                <div className="dash-empty-icon">∅</div>
                <h3 className="dash-empty-title">No departments</h3>
                <p className="dash-empty-description">Configure departments in settings.</p>
              </div>
            ) : (
              <div className="dash-grid dash-grid-3">
                {departments.map((dept) => (
                  <div key={dept.id} className="dept-card">
                    <div className="dept-card-header">
                      <h3 className="dept-card-name">{dept.name}</h3>
                      <div className="dept-ring">
                        <svg viewBox="0 0 36 36" className="dept-ring-svg">
                          <path
                            className="dept-ring-bg"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          <path
                            className="dept-ring-fill"
                            strokeDasharray={`${dept.avgProgress}, 100`}
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>
                        <span className="dept-ring-value">{dept.avgProgress}%</span>
                      </div>
                    </div>
                    <div className="dept-card-stats">
                      <div className="dept-stat">
                        <span className="dept-stat-value">{dept.internCount}</span>
                        <span className="dept-stat-label">Interns</span>
                      </div>
                      <div className="dept-stat">
                        <span className="dept-stat-value">{dept.supervisorCount}</span>
                        <span className="dept-stat-label">Supervisors</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* Intern Detail Modal */}
      <Modal
        isOpen={isInternModalOpen}
        onClose={() => setIsInternModalOpen(false)}
        title={selectedIntern?.name || ''}
      >
        {selectedIntern && (
          <div className="intern-modal-content">
            <div className="intern-modal-header">
              <span className="intern-modal-avatar" aria-hidden="true">{getInitials(selectedIntern.name)}</span>
              <div className="intern-modal-info">
                <h3>{selectedIntern.name}</h3>
                <p className="intern-modal-email">{selectedIntern.email}</p>
              </div>
            </div>

            <div className="intern-modal-grid">
              <div className="intern-modal-field">
                <span className="intern-modal-label">Department</span>
                <span className="intern-modal-value">{selectedIntern.department || '-'}</span>
              </div>
              <div className="intern-modal-field">
                <span className="intern-modal-label">Mission</span>
                <span className="intern-modal-value">{selectedIntern.missionTitle || '-'}</span>
              </div>
              <div className="intern-modal-field">
                <span className="intern-modal-label">Supervisor</span>
                <span className="intern-modal-value">{selectedIntern.supervisorName || '-'}</span>
              </div>
              <div className="intern-modal-field">
                <span className="intern-modal-label">Start date</span>
                <span className="intern-modal-value">{selectedIntern.startDate || '-'}</span>
              </div>
              <div className="intern-modal-field">
                <span className="intern-modal-label">End date</span>
                <span className="intern-modal-value">{selectedIntern.endDate || '-'}</span>
              </div>
              <div className="intern-modal-field">
                <span className="intern-modal-label">Status</span>
                <span className={`dash-status-badge dash-status-badge-${selectedIntern.status}`}>{selectedIntern.status}</span>
              </div>
            </div>

            <div className="intern-modal-progress">
              <div className="intern-modal-progress-header">
                <span className="intern-modal-label">Progress</span>
                <span className="intern-modal-progress-value">{selectedIntern.progress}%</span>
              </div>
              <div className="dash-progress">
                <div
                  className={`dash-progress-fill ${selectedIntern.status === 'completed' ? 'dash-progress-fill-success' : ''}`}
                  style={{ width: `${selectedIntern.progress}%` }}
                />
              </div>
            </div>

            <div className="intern-modal-actions">
              <DashboardButton variant="secondary" onClick={() => setIsInternModalOpen(false)}>
                Close
              </DashboardButton>
              <DashboardButton variant="primary">View full profile</DashboardButton>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  )
}

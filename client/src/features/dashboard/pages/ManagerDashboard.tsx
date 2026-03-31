import { useState, useEffect, useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { useDashboardApi } from '../hooks/useDashboardApi'
import { Skeleton } from '../components/Skeleton'
import { ErrorState } from '../components/ErrorState'
import { Modal } from '../components/Modal'
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

interface KPI {
  label: string
  value: string | number
  change?: number
  changeLabel?: string
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
  if (name) {
    return name
  }

  const firstName = asNonEmptyString(user.firstName)
  const lastName = asNonEmptyString(user.lastName)
  const fullName = `${firstName} ${lastName}`.trim()
  if (fullName) {
    return fullName
  }

  return asNonEmptyString(user.email) || 'Unknown'
}

function readNumericValue(payload: unknown): number {
  if (typeof payload === 'number') {
    return payload
  }

  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>
    const numericKeys = ['count', 'value', 'total']
    for (const key of numericKeys) {
      const candidate = record[key]
      if (typeof candidate === 'number') {
        return candidate
      }
    }
  }

  return 0
}

function normalizeInternStatus(statusValue: string): Intern['status'] {
  const status = statusValue.trim().toLowerCase()

  if (status === 'completed' || status === 'done' || status === 'finished') {
    return 'completed'
  }

  if (status === 'pending' || status === 'awaiting' || status === 'not_started') {
    return 'pending'
  }

  return 'active'
}

function estimateProgress(startDate?: string, endDate?: string, statusValue?: string): number {
  if (normalizeInternStatus(statusValue ?? '') === 'completed') {
    return 100
  }

  const start = startDate ? Date.parse(startDate) : NaN
  const end = endDate ? Date.parse(endDate) : NaN
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 0
  }

  const now = Date.now()
  if (now <= start) {
    return 0
  }

  if (now >= end) {
    return 100
  }

  return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)))
}

function inferActivityType(action: string): Activity['type'] {
  const normalized = action.toLowerCase()

  if (normalized.includes('deliverable') || normalized.includes('submit')) {
    return 'submission'
  }

  if (normalized.includes('evaluation')) {
    return 'evaluation'
  }

  if (normalized.includes('mission')) {
    return 'mission_created'
  }

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
  const [kpis, setKpis] = useState<KPI[]>([])
  const [interns, setInterns] = useState<Intern[]>([])
  const [supervisors, setSupervisors] = useState<Supervisor[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [activities, setActivities] = useState<Activity[]>([])

  // Filter states
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all')
  const [internsSearch, setInternsSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'interns' | 'supervisors' | 'departments'>('overview')

  // Modal states
  const [selectedIntern, setSelectedIntern] = useState<Intern | null>(null)
  const [isInternModalOpen, setIsInternModalOpen] = useState(false)

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message.trim()) {
      return error.message
    }

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
      const completionPercent = internshipsData.length > 0
        ? Math.round((completedInternships / internshipsData.length) * 100)
        : 0

      setKpis([
        { label: 'Total Interns', value: readNumericValue(internsCountPayload) },
        { label: 'Active Missions', value: readNumericValue(missionsPayload) },
        { label: 'Avg Completion', value: `${completionPercent}%` },
        { label: 'Pending Reviews', value: readNumericValue(pendingPayload) },
      ])
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
        if (internId) {
          internshipsByInternId.set(internId, internship)
        }
      }

      const mappedInterns: Intern[] = (internUsersPayload.data ?? [])
        .map((user): Intern | null => {
          const userId = asNonEmptyString(user.id)
          if (!userId) {
            return null
          }

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

        if (!supervisorId || internshipStatus === 'completed') {
          continue
        }

        activeInternsBySupervisorId.set(supervisorId, (activeInternsBySupervisorId.get(supervisorId) ?? 0) + 1)
      }

      const mappedSupervisors: Supervisor[] = (supervisorUsersPayload.data ?? [])
        .map((user): Supervisor | null => {
          const userId = asNonEmptyString(user.id)
          if (!userId) {
            return null
          }

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
        if (!departmentName) {
          continue
        }

        const progress = estimateProgress(internship.startDate, internship.endDate, internship.status)
        const current = progressByDepartment.get(departmentName) ?? []
        current.push(progress)
        progressByDepartment.set(departmentName, current)
      }

      const mappedDepartments: Department[] = (departmentPayload ?? [])
        .map((department): Department | null => {
          const name = asNonEmptyString(department.name)
          const id = asNonEmptyString(department.id)
          if (!name || !id) {
            return null
          }

          const internCount = (internUsersPayload.data ?? []).filter((user) => asNonEmptyString(user.department) === name).length
          const supervisorCount = (supervisorUsersPayload.data ?? []).filter((user) => asNonEmptyString(user.department) === name).length
          const progressValues = progressByDepartment.get(name) ?? []
          const avgProgress = progressValues.length > 0
            ? Math.round(progressValues.reduce((sum, value) => sum + value, 0) / progressValues.length)
            : 0

          return {
            id,
            name,
            internCount,
            supervisorCount,
            avgProgress,
          }
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
          if (!action) {
            return null
          }

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

  const filteredInterns = useMemo(() => {
    return interns.filter(intern => {
      const matchesDepartment = selectedDepartment === 'all' || intern.department === selectedDepartment
      const matchesSearch = intern.name.toLowerCase().includes(internsSearch.toLowerCase()) ||
                          intern.email.toLowerCase().includes(internsSearch.toLowerCase())
      return matchesDepartment && matchesSearch
    })
  }, [interns, selectedDepartment, internsSearch])

  const departmentOptions = useMemo(() => {
    const deps = new Set(interns.map(i => i.department).filter(Boolean))
    return ['all', ...Array.from(deps)]
  }, [interns])

  const openInternModal = (intern: Intern) => {
    setSelectedIntern(intern)
    setIsInternModalOpen(true)
  }

  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'submission': return '▲'
      case 'evaluation': return '◆'
      case 'mission_created': return '●'
      case 'meeting': return '■'
      default: return '●'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
  }

  return (
    <div className="manager-dashboard">
      {/* Header */}
      <header className="manager-header">
        <div className="manager-header-content">
          <div>
            <h1 className="manager-title">Manager Dashboard</h1>
            <p className="manager-subtitle">Overview of internship program across departments</p>
          </div>
          <div className="manager-header-actions">
            <button
              className="manager-btn manager-btn-primary"
              onClick={() => {
                void loadKPIs()
                void loadInterns()
                void loadSupervisors()
                void loadDepartments()
                void loadActivity()
              }}
            >
              Refresh Data
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="manager-nav">
        <button
          className={`manager-tab ${activeTab === 'overview' ? 'manager-tab-active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`manager-tab ${activeTab === 'interns' ? 'manager-tab-active' : ''}`}
          onClick={() => setActiveTab('interns')}
        >
          Interns
          <span className="manager-tab-badge">{interns.length}</span>
        </button>
        <button
          className={`manager-tab ${activeTab === 'supervisors' ? 'manager-tab-active' : ''}`}
          onClick={() => setActiveTab('supervisors')}
        >
          Supervisors
          <span className="manager-tab-badge">{supervisors.length}</span>
        </button>
        <button
          className={`manager-tab ${activeTab === 'departments' ? 'manager-tab-active' : ''}`}
          onClick={() => setActiveTab('departments')}
        >
          Departments
          <span className="manager-tab-badge">{departments.length}</span>
        </button>
      </nav>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* KPI Cards */}
          <section className="manager-section">
            <div className="manager-kpi-grid">
              {loadingKPIs ? (
                <>
                  <Skeleton height="140px" />
                  <Skeleton height="140px" />
                  <Skeleton height="140px" />
                  <Skeleton height="140px" />
                </>
              ) : kpisError ? (
                <ErrorState message={kpisError} onRetry={loadKPIs} />
              ) : (
                kpis.map((kpi, index) => (
                  <div key={index} className="manager-kpi-card">
                    <div className="manager-kpi-content">
                      <span className="manager-kpi-label">{kpi.label}</span>
                      <span className="manager-kpi-value">{kpi.value}</span>
                      {kpi.change !== undefined && (
                        <span className={`manager-kpi-change ${kpi.change >= 0 ? 'manager-kpi-change-positive' : 'manager-kpi-change-negative'}`}>
                          {kpi.change >= 0 ? '+' : ''}{kpi.change}%
                          <span className="manager-kpi-change-label">{kpi.changeLabel}</span>
                        </span>
                      )}
                    </div>
                    <div className="manager-kpi-decoration" />
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Two Column Layout */}
          <div className="manager-two-column">
            {/* Department Progress */}
            <section className="manager-section manager-section-flex">
              <div className="manager-section-header">
                <h2 className="manager-section-title">Department Progress</h2>
              </div>
              {loadingDepartments ? (
                <Skeleton height="200px" />
              ) : departmentsError ? (
                <ErrorState message={departmentsError} onRetry={loadDepartments} />
              ) : (
                <div className="manager-department-list">
                  {departments.map((dept) => (
                    <div key={dept.id} className="manager-department-item">
                      <div className="manager-department-info">
                        <span className="manager-department-name">{dept.name}</span>
                        <span className="manager-department-meta">{dept.internCount} interns · {dept.supervisorCount} supervisors</span>
                      </div>
                      <div className="manager-progress-wrapper">
                        <div className="manager-progress-bar-bg">
                          <div
                            className="manager-progress-bar-fill"
                            style={{ width: `${dept.avgProgress}%` }}
                          />
                        </div>
                        <span className="manager-progress-value">{dept.avgProgress}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Recent Activity */}
            <section className="manager-section manager-section-flex">
              <div className="manager-section-header">
                <h2 className="manager-section-title">Recent Activity</h2>
              </div>
              {loadingActivity ? (
                <Skeleton height="200px" />
              ) : activityError ? (
                <ErrorState message={activityError} onRetry={loadActivity} />
              ) : (
                <div className="manager-activity-list">
                  {activities.map((activity) => (
                    <div key={activity.id} className="manager-activity-item">
                      <div className={`manager-activity-icon manager-activity-icon-${activity.type}`}>
                        {getActivityIcon(activity.type)}
                      </div>
                      <div className="manager-activity-content">
                        <p className="manager-activity-description">
                          <strong>{activity.actor}</strong> {activity.description}
                        </p>
                        <span className="manager-activity-time">{formatDate(activity.timestamp)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}

      {/* Interns Tab */}
      {activeTab === 'interns' && (
        <section className="manager-section">
          <div className="manager-section-header">
            <h2 className="manager-section-title">Interns</h2>
            <div className="manager-filters">
              <input
                type="text"
                placeholder={t('dashboard.table.search') || 'Search interns...'}
                value={internsSearch}
                onChange={(e) => setInternsSearch(e.target.value)}
                className="manager-search-input"
              />
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="manager-filter-select"
              >
                <option value="all">All Departments</option>
                {departmentOptions.filter(d => d !== 'all').map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>
          {loadingInterns ? (
            <Skeleton height="400px" />
          ) : internsError ? (
            <ErrorState message={internsError} onRetry={loadInterns} />
          ) : (
            <div className="manager-table-wrapper">
              <table className="manager-table">
                <thead>
                  <tr>
                    <th>{t('dashboard.table.name') || 'Name'}</th>
                    <th>Department</th>
                    <th>{t('dashboard.table.mission') || 'Mission'}</th>
                    <th>Supervisor</th>
                    <th>Progress</th>
                    <th>{t('dashboard.table.status') || 'Status'}</th>
                    <th>{t('dashboard.table.actions') || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInterns.map((intern) => (
                    <tr key={intern.id} className="manager-table-row">
                      <td>
                        <div className="manager-intern-cell">
                          <div className="manager-intern-avatar">
                            {intern.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <div className="manager-intern-name">{intern.name}</div>
                            <div className="manager-intern-email">{intern.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>{intern.department || '-'}</td>
                      <td>{intern.missionTitle || '-'}</td>
                      <td>{intern.supervisorName || '-'}</td>
                      <td>
                        <div className="manager-table-progress">
                          <div className="manager-table-progress-bar">
                            <div
                              className={`manager-table-progress-fill manager-table-progress-fill-${intern.status}`}
                              style={{ width: `${intern.progress}%` }}
                            />
                          </div>
                          <span>{intern.progress}%</span>
                        </div>
                      </td>
                      <td>
                        <span className={`manager-status-badge manager-status-${intern.status}`}>
                          {intern.status}
                        </span>
                      </td>
                      <td>
                        <button
                          className="manager-btn manager-btn-ghost"
                          onClick={() => openInternModal(intern)}
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
        </section>
      )}

      {/* Supervisors Tab */}
      {activeTab === 'supervisors' && (
        <section className="manager-section">
          <div className="manager-section-header">
            <h2 className="manager-section-title">Supervisors</h2>
          </div>
          {loadingSupervisors ? (
            <div className="manager-supervisor-grid">
              <Skeleton height="160px" />
              <Skeleton height="160px" />
              <Skeleton height="160px" />
            </div>
          ) : supervisorsError ? (
            <ErrorState message={supervisorsError} onRetry={loadSupervisors} />
          ) : (
            <div className="manager-supervisor-grid">
              {supervisors.map((supervisor) => (
                <div key={supervisor.id} className="manager-supervisor-card">
                  <div className="manager-supervisor-avatar">
                    {supervisor.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="manager-supervisor-info">
                    <h3 className="manager-supervisor-name">{supervisor.name}</h3>
                    <p className="manager-supervisor-email">{supervisor.email}</p>
                    <p className="manager-supervisor-department">{supervisor.department || 'No Department'}</p>
                  </div>
                  <div className="manager-supervisor-stats">
                    <span className="manager-supervisor-stat-value">{supervisor.activeInternsCount}</span>
                    <span className="manager-supervisor-stat-label">Active Interns</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* SVG Gradient Definition */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="deptGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>

      {/* Departments Tab */}
      {activeTab === 'departments' && (
        <section className="manager-section">
          <div className="manager-section-header">
            <h2 className="manager-section-title">Departments</h2>
          </div>
          {loadingDepartments ? (
            <Skeleton height="300px" />
          ) : departmentsError ? (
            <ErrorState message={departmentsError} onRetry={loadDepartments} />
          ) : (
            <div className="manager-dept-grid">
              {departments.map((dept) => (
                <div key={dept.id} className="manager-dept-card">
                  <div className="manager-dept-card-header">
                    <h3 className="manager-dept-card-name">{dept.name}</h3>
                    <div className="manager-dept-progress-ring">
                      <svg viewBox="0 0 36 36" className="manager-dept-ring">
                        <path
                          className="manager-dept-ring-bg"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="manager-dept-ring-fill"
                          strokeDasharray={`${dept.avgProgress}, 100`}
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <span className="manager-dept-ring-value">{dept.avgProgress}%</span>
                    </div>
                  </div>
                  <div className="manager-dept-card-stats">
                    <div className="manager-dept-stat">
                      <span className="manager-dept-stat-value">{dept.internCount}</span>
                      <span className="manager-dept-stat-label">Interns</span>
                    </div>
                    <div className="manager-dept-stat">
                      <span className="manager-dept-stat-value">{dept.supervisorCount}</span>
                      <span className="manager-dept-stat-label">Supervisors</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Intern Detail Modal */}
      <Modal
        isOpen={isInternModalOpen}
        onClose={() => setIsInternModalOpen(false)}
        title={selectedIntern?.name || ''}
      >
        {selectedIntern && (
          <div className="manager-intern-detail">
            <div className="manager-intern-detail-header">
              <div className="manager-intern-detail-avatar">
                {selectedIntern.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </div>
              <div className="manager-intern-detail-info">
                <h3>{selectedIntern.name}</h3>
                <p>{selectedIntern.email}</p>
              </div>
            </div>
            <div className="manager-intern-detail-grid">
              <div className="manager-intern-detail-item">
                <span className="manager-intern-detail-label">Department</span>
                <span className="manager-intern-detail-value">{selectedIntern.department || '-'}</span>
              </div>
              <div className="manager-intern-detail-item">
                <span className="manager-intern-detail-label">Mission</span>
                <span className="manager-intern-detail-value">{selectedIntern.missionTitle || '-'}</span>
              </div>
              <div className="manager-intern-detail-item">
                <span className="manager-intern-detail-label">Supervisor</span>
                <span className="manager-intern-detail-value">{selectedIntern.supervisorName || '-'}</span>
              </div>
              <div className="manager-intern-detail-item">
                <span className="manager-intern-detail-label">Start Date</span>
                <span className="manager-intern-detail-value">{selectedIntern.startDate || '-'}</span>
              </div>
              <div className="manager-intern-detail-item">
                <span className="manager-intern-detail-label">End Date</span>
                <span className="manager-intern-detail-value">{selectedIntern.endDate || '-'}</span>
              </div>
              <div className="manager-intern-detail-item">
                <span className="manager-intern-detail-label">Status</span>
                <span className={`manager-status-badge manager-status-${selectedIntern.status}`}>
                  {selectedIntern.status}
                </span>
              </div>
            </div>
            <div className="manager-intern-detail-progress">
              <span className="manager-intern-detail-label">Progress</span>
              <div className="manager-progress-bar-bg">
                <div
                  className="manager-progress-bar-fill"
                  style={{ width: `${selectedIntern.progress}%` }}
                />
              </div>
              <span className="manager-intern-detail-progress-value">{selectedIntern.progress}%</span>
            </div>
            <div className="manager-modal-actions">
              <button
                className="manager-btn manager-btn-secondary"
                onClick={() => setIsInternModalOpen(false)}
              >
                Close
              </button>
              <button className="manager-btn manager-btn-primary">View Full Profile</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

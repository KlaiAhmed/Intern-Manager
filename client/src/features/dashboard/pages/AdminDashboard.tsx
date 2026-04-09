import { useState, useEffect } from 'react'
import { useI18n } from '../../../locales/I18nContext'
import { KPICard } from '../components/KPICard'
import { DataTable } from '../components/DataTable'
import { Modal } from '../components/Modal'
import { Skeleton } from '../components/Skeleton'
import { ErrorState } from '../components/ErrorState'
import { useDashboardApi } from '../hooks/useDashboardApi'

interface User {
  id: string
  name: string
  email: string
  status: string
  role: string
  department?: string
}

interface AuditLog {
  id: string
  actor: string
  action: string
  entity: string
  timestamp: string
}

interface Department {
  id: string
  name: string
}

type UserTab = 'intern' | 'supervisor' | 'manager'

/**
 * Tableau de bord pour le rôle admin.
 * Gère les comptes utilisateurs et les paramètres de l'application.
 */
export function AdminDashboard() {
  const { t } = useI18n()
  const api = useDashboardApi()

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message.trim()) {
      return error.message
    }

    return t('dashboard.error.load')
  }

  // KPI states
  const [internsCount, setInternsCount] = useState<number | null>(null)
  const [supervisorsCount, setSupervisorsCount] = useState<number | null>(null)
  const [activeInternshipsCount, setActiveInternshipsCount] = useState<number | null>(null)
  const [pendingDeliverablesCount, setPendingDeliverablesCount] = useState<number | null>(null)

  // User management state
  const [activeTab, setActiveTab] = useState<UserTab>('intern')
  const [users, setUsers] = useState<User[]>([])
  const [usersPage, setUsersPage] = useState(1)
  const [usersTotal, setUsersTotal] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [departments, setDepartments] = useState<Department[]>([])

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

  // Modal state
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false)
  const [userFormData, setUserFormData] = useState({ firstName: '', lastName: '', email: '', role: 'intern', department: '', status: 'active' })
  const [userFormErrors, setUserFormErrors] = useState<Record<string, string>>({})

  // Loading states
  const [loadingKpis, setLoadingKpis] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(true)

  // Error states
  const [kpisError, setKpisError] = useState<string | null>(null)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [auditLogsError, setAuditLogsError] = useState<string | null>(null)

  const loadKpis = async () => {
    setLoadingKpis(true)
    setKpisError(null)
    try {
      const [interns, supervisors, activeInternships, pendingDeliverables] = await Promise.all([
        api.get<{ count: number }>('/api/stats/interns/count'),
        api.get<{ count: number }>('/api/stats/supervisors/count'),
        api.get<{ count: number }>('/api/stats/internships/active'),
        api.get<{ count: number }>('/api/stats/deliverables/pending'),
      ])
      setInternsCount(interns.count)
      setSupervisorsCount(supervisors.count)
      setActiveInternshipsCount(activeInternships.count)
      setPendingDeliverablesCount(pendingDeliverables.count)
    } catch (error) {
      setKpisError(getErrorMessage(error))
    } finally {
      setLoadingKpis(false)
    }
  }

  const loadUsers = async (page: number = 1) => {
    setLoadingUsers(true)
    setUsersError(null)
    try {
      let url = `/api/users?role=${activeTab}&page=${page}&limit=10`
      if (statusFilter !== 'all') url += `&status=${statusFilter}`
      if (departmentFilter !== 'all') url += `&department=${departmentFilter}`
      if (searchQuery.trim()) url += `&search=${encodeURIComponent(searchQuery)}`
      
      const result = await api.get<{ data: User[]; total: number }>(url)
      setUsers(result.data ?? [])
      setUsersTotal(result.total ?? 0)
      setUsersPage(page)
    } catch (error) {
      setUsersError(getErrorMessage(error))
    } finally {
      setLoadingUsers(false)
    }
  }

  const loadDepartments = async () => {
    try {
      const result = await api.get<Department[]>('/api/admin/settings/departments')
      setDepartments(result ?? [])
    } catch (error) {
      setUsersError(getErrorMessage(error))
    }
  }

  const loadAuditLogs = async () => {
    setLoadingAuditLogs(true)
    setAuditLogsError(null)
    try {
      const result = await api.get<{ data: AuditLog[] }>('/api/admin/audit-logs?limit=20')
      setAuditLogs(result.data ?? [])
    } catch (error) {
      setAuditLogsError(getErrorMessage(error))
    } finally {
      setLoadingAuditLogs(false)
    }
  }

  useEffect(() => {
    void loadKpis()
    void loadDepartments()
    void loadAuditLogs()
  }, [])

  useEffect(() => {
    void loadUsers(1)
  }, [activeTab, statusFilter, departmentFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadUsers(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const validateUserForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!userFormData.firstName.trim()) errors.firstName = t('dashboard.form.required')
    if (!userFormData.lastName.trim()) errors.lastName = t('dashboard.form.required')
    if (!userFormData.email.trim()) errors.email = t('dashboard.form.required')
    setUserFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleAddUser = async () => {
    if (!validateUserForm()) return
    try {
      await api.post('/api/users', {
        firstName: userFormData.firstName.trim(),
        lastName: userFormData.lastName.trim(),
        email: userFormData.email.trim(),
        role: userFormData.role,
        department: userFormData.department,
        status: userFormData.status,
      })
      setIsAddUserModalOpen(false)
      setUserFormData({ firstName: '', lastName: '', email: '', role: 'intern', department: '', status: 'active' })
      void loadUsers(usersPage)
    } catch (error) {
      setUserFormErrors({ submit: getErrorMessage(error) })
    }
  }

  const handleEditUser = (userId: string) => {
    console.log('Edit user:', userId)
  }

  const handleArchiveUser = async (userId: string) => {
    try {
      await api.patch(`/api/users/${userId}`, { status: 'archived' })
      void loadUsers(usersPage)
    } catch (error) {
      setUsersError(getErrorMessage(error))
    }
  }

  const handleActivateUser = async (userId: string) => {
    try {
      await api.patch(`/api/users/${userId}`, { status: 'active' })
      void loadUsers(usersPage)
    } catch (error) {
      setUsersError(getErrorMessage(error))
    }
  }

  const userTableColumns = [
    { key: 'name', label: t('dashboard.table.name') },
    { key: 'email', label: t('dashboard.table.email') },
    { key: 'status', label: t('dashboard.table.status') },
    { key: 'role', label: t('dashboard.table.role') },
    { key: 'actions', label: t('dashboard.table.actions') },
  ]

  const auditLogColumns = [
    { key: 'actor', label: t('dashboard.table.actor') },
    { key: 'action', label: t('dashboard.table.action') },
    { key: 'entity', label: t('dashboard.table.entity') },
    { key: 'timestamp', label: t('dashboard.table.timestamp') },
  ]

  const tabs: { key: UserTab; label: string }[] = [
    { key: 'intern', label: t('dashboard.admin.tabInterns') },
    { key: 'supervisor', label: t('dashboard.admin.tabSupervisors') },
    { key: 'manager', label: t('dashboard.admin.tabManagers') },
  ]

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1 className="dashboard-title">{t('dashboard.admin.title')}</h1>
      </header>

      {/* KPI Summary Cards */}
      <section className="dashboard-section">
        <div className="kpi-grid">
          {loadingKpis ? (
            <>
              <Skeleton height="120px" />
              <Skeleton height="120px" />
              <Skeleton height="120px" />
              <Skeleton height="120px" />
            </>
          ) : kpisError ? (
            <ErrorState message={kpisError} onRetry={loadKpis} />
          ) : (
            <>
              <KPICard title={t('dashboard.kpi.totalInterns')} value={internsCount ?? 0} />
              <KPICard title={t('dashboard.kpi.totalSupervisors')} value={supervisorsCount ?? 0} />
              <KPICard title={t('dashboard.kpi.activeInternships')} value={activeInternshipsCount ?? 0} />
              <KPICard title={t('dashboard.kpi.pendingDeliverables')} value={pendingDeliverablesCount ?? 0} />
            </>
          )}
        </div>
      </section>

      {/* User Accounts Management Panel */}
      <section className="dashboard-section">
        <div className="section-header-row">
          <h2 className="dashboard-section-title">{t('dashboard.admin.userAccounts')}</h2>
          <button className="button button-primary button-sm" onClick={() => setIsAddUserModalOpen(true)}>
            {t('dashboard.admin.addUser')}
          </button>
        </div>

        {/* Tabs */}
        <div className="tabs-container">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`tab-button ${activeTab === tab.key ? 'tab-active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="filters-row">
          <input
            type="text"
            placeholder={t('dashboard.table.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="filter-select"
            aria-label={t('dashboard.admin.filterByStatus')}
          >
            <option value="all">{t('dashboard.admin.allStatuses')}</option>
            <option value="active">{t('dashboard.admin.statusActive')}</option>
            <option value="archived">{t('dashboard.admin.statusArchived')}</option>
          </select>
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="filter-select"
            aria-label={t('dashboard.admin.filterByDepartment')}
          >
            <option value="all">{t('dashboard.admin.allDepartments')}</option>
            {departments.map((dept) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </div>

        {loadingUsers ? (
          <Skeleton height="300px" />
        ) : usersError ? (
          <ErrorState message={usersError} onRetry={() => loadUsers(usersPage)} />
        ) : users.length === 0 ? (
          <p className="empty-state">{t('dashboard.table.noResults')}</p>
        ) : (
          <DataTable
            columns={userTableColumns}
            data={users.map((user) => ({
              ...user,
              actions: (
                <div className="table-actions">
                  <button className="action-button" onClick={() => handleEditUser(user.id)}>
                    {t('dashboard.table.edit')}
                  </button>
                  {user.status === 'active' ? (
                    <button className="action-button action-button-danger" onClick={() => handleArchiveUser(user.id)}>
                      {t('dashboard.table.archive')}
                    </button>
                  ) : (
                    <button className="action-button" onClick={() => handleActivateUser(user.id)}>
                      {t('dashboard.table.activate')}
                    </button>
                  )}
                </div>
              ),
            }))}
            page={usersPage}
            totalPages={Math.ceil(usersTotal / 10)}
            onPageChange={loadUsers}
          />
        )}
      </section>

      {/* App Settings Panel */}
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">{t('dashboard.admin.appSettings')}</h2>
        <div className="settings-links-grid">
          <a href="/settings/departments" className="settings-link-card">
            {t('dashboard.superAdmin.departments')}
          </a>
          <a href="/settings/schools" className="settings-link-card">
            {t('dashboard.superAdmin.schools')}
          </a>
          <a href="/settings/internship-types" className="settings-link-card">
            {t('dashboard.superAdmin.internshipTypes')}
          </a>
          <a href="/settings/skills" className="settings-link-card">
            {t('dashboard.superAdmin.skills')}
          </a>
        </div>
      </section>

      {/* Recent Audit Logs */}
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">{t('dashboard.admin.auditLogs')}</h2>
        {loadingAuditLogs ? (
          <Skeleton height="200px" />
        ) : auditLogsError ? (
          <ErrorState message={auditLogsError} onRetry={loadAuditLogs} />
        ) : auditLogs.length === 0 ? (
          <p className="empty-state">{t('dashboard.noData')}</p>
        ) : (
          <DataTable columns={auditLogColumns} data={auditLogs} />
        )}
      </section>

      {/* Add User Modal */}
      <Modal isOpen={isAddUserModalOpen} onClose={() => setIsAddUserModalOpen(false)} title={t('dashboard.admin.addUser')}>
        <form className="modal-form" onSubmit={(e) => { e.preventDefault(); void handleAddUser() }}>
          <div className="form-field">
            <label htmlFor="user-first-name">First Name</label>
            <input
              id="user-first-name"
              type="text"
              value={userFormData.firstName}
              onChange={(e) => setUserFormData({ ...userFormData, firstName: e.target.value })}
              className={userFormErrors.firstName ? 'input-error' : ''}
            />
            {userFormErrors.firstName && <span className="field-error">{userFormErrors.firstName}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="user-last-name">Last Name</label>
            <input
              id="user-last-name"
              type="text"
              value={userFormData.lastName}
              onChange={(e) => setUserFormData({ ...userFormData, lastName: e.target.value })}
              className={userFormErrors.lastName ? 'input-error' : ''}
            />
            {userFormErrors.lastName && <span className="field-error">{userFormErrors.lastName}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="user-email">{t('dashboard.form.email')}</label>
            <input
              id="user-email"
              type="email"
              value={userFormData.email}
              onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
              className={userFormErrors.email ? 'input-error' : ''}
            />
            {userFormErrors.email && <span className="field-error">{userFormErrors.email}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="user-role">{t('dashboard.form.role')}</label>
            <select
              id="user-role"
              value={userFormData.role}
              onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
            >
              <option value="intern">{t('role.intern')}</option>
              <option value="supervisor">{t('role.supervisor')}</option>
              <option value="manager">{t('role.manager')}</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="user-department">{t('dashboard.form.department')}</label>
            <select
              id="user-department"
              value={userFormData.department}
              onChange={(e) => setUserFormData({ ...userFormData, department: e.target.value })}
            >
              <option value="">{t('dashboard.admin.allDepartments')}</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="user-status">{t('dashboard.form.status')}</label>
            <select
              id="user-status"
              value={userFormData.status}
              onChange={(e) => setUserFormData({ ...userFormData, status: e.target.value })}
            >
              <option value="active">{t('dashboard.admin.statusActive')}</option>
              <option value="archived">{t('dashboard.admin.statusArchived')}</option>
            </select>
          </div>
          {userFormErrors.submit && <p className="form-error">{userFormErrors.submit}</p>}
          <div className="modal-actions">
            <button type="button" className="button button-secondary button-sm" onClick={() => setIsAddUserModalOpen(false)}>
              {t('dashboard.form.cancel')}
            </button>
            <button type="submit" className="button button-primary button-sm">
              {t('dashboard.form.save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}


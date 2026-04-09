import { useState, useEffect, useCallback } from 'react'
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

interface PasswordValidation {
  hasMinLength: boolean
  hasUppercase: boolean
  hasLowercase: boolean
  hasNumber: boolean
  hasSpecialChar: boolean
}

function validatePassword(password: string): PasswordValidation {
  return {
    hasMinLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
  }
}

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
  const [userFormData, setUserFormData] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', role: 'intern', department: '', status: 'active' })
  const [userFormErrors, setUserFormErrors] = useState<Record<string, string | string[]>>({})
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})
  const [passwordValidation, setPasswordValidation] = useState<PasswordValidation>({
    hasMinLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
  })

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

  const getPasswordErrors = useCallback((password: string): string[] => {
    const errors: string[] = []
    const validation = validatePassword(password)

    if (!password) {
      errors.push(t('auth.validation.passwordRequired'))
      return errors
    }
    if (!validation.hasMinLength) {
      errors.push(t('auth.validation.passwordMin'))
    }
    if (!validation.hasUppercase) {
      errors.push(t('auth.validation.passwordUppercase'))
    }
    if (!validation.hasLowercase) {
      errors.push(t('auth.validation.passwordLowercase'))
    }
    if (!validation.hasNumber) {
      errors.push(t('auth.validation.passwordNumber'))
    }
    if (!validation.hasSpecialChar) {
      errors.push(t('auth.validation.passwordSpecial'))
    }

    return errors
  }, [t])

  const validateField = useCallback((field: string, value: string, formData: typeof userFormData): string | string[] => {
    switch (field) {
      case 'firstName':
        return value.trim() ? '' : t('dashboard.form.required')
      case 'lastName':
        return value.trim() ? '' : t('dashboard.form.required')
      case 'email':
        if (!value.trim()) return t('dashboard.form.required')
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return t('auth.validation.emailInvalid')
        return ''
      case 'password':
        return getPasswordErrors(value)
      case 'confirmPassword':
        if (!value.trim()) return t('auth.validation.confirmPasswordRequired')
        if (value !== formData.password) return t('auth.validation.passwordsMismatch')
        return ''
      default:
        return ''
    }
  }, [t, getPasswordErrors])

  const handleFieldChange = (field: string, value: string) => {
    const newFormData = { ...userFormData, [field]: value }
    setUserFormData(newFormData)

    if (!touchedFields[field]) {
      setTouchedFields(prev => ({ ...prev, [field]: true }))
    }

    const error = validateField(field, value, newFormData)
    setUserFormErrors(prev => ({ ...prev, [field]: error }))

    if (field === 'password') {
      setPasswordValidation(validatePassword(value))
      if (touchedFields.confirmPassword && newFormData.confirmPassword) {
        const confirmError = validateField('confirmPassword', newFormData.confirmPassword, newFormData)
        setUserFormErrors(prev => ({ ...prev, confirmPassword: confirmError as string }))
      }
    }
  }

  const validateUserForm = (): boolean => {
    const errors: Record<string, string | string[]> = {}

    const firstNameError = validateField('firstName', userFormData.firstName, userFormData)
    if (firstNameError) errors.firstName = firstNameError

    const lastNameError = validateField('lastName', userFormData.lastName, userFormData)
    if (lastNameError) errors.lastName = lastNameError

    const emailError = validateField('email', userFormData.email, userFormData)
    if (emailError) errors.email = emailError

    const passwordErrors = validateField('password', userFormData.password, userFormData)
    if (Array.isArray(passwordErrors) && passwordErrors.length > 0) {
      errors.password = passwordErrors
    }

    const confirmPasswordError = validateField('confirmPassword', userFormData.confirmPassword, userFormData)
    if (confirmPasswordError) errors.confirmPassword = confirmPasswordError

    setUserFormErrors(errors)
    setTouchedFields({ firstName: true, lastName: true, email: true, password: true, confirmPassword: true })

    return Object.keys(errors).length === 0
  }

  const handleAddUser = async () => {
    if (!validateUserForm()) return
    try {
      await api.post('/api/users', {
        firstName: userFormData.firstName.trim(),
        lastName: userFormData.lastName.trim(),
        email: userFormData.email.trim(),
        password: userFormData.password.trim(),
        role: userFormData.role,
        department: userFormData.department,
        status: userFormData.status,
      })
      setIsAddUserModalOpen(false)
      setUserFormData({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', role: 'intern', department: '', status: 'active' })
      setUserFormErrors({})
      setTouchedFields({})
      setPasswordValidation({
        hasMinLength: false,
        hasUppercase: false,
        hasLowercase: false,
        hasNumber: false,
        hasSpecialChar: false,
      })
      void loadUsers(usersPage)
    } catch (error) {
      setUserFormErrors({ submit: getErrorMessage(error) })
    }
  }

  const handleCloseModal = () => {
    setIsAddUserModalOpen(false)
    setUserFormData({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '', role: 'intern', department: '', status: 'active' })
    setUserFormErrors({})
    setTouchedFields({})
    setPasswordValidation({
      hasMinLength: false,
      hasUppercase: false,
      hasLowercase: false,
      hasNumber: false,
      hasSpecialChar: false,
    })
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

  const passwordRequirements = [
    { key: 'hasMinLength', label: t('auth.validation.passwordMin') },
    { key: 'hasUppercase', label: t('auth.validation.passwordUppercase') },
    { key: 'hasLowercase', label: t('auth.validation.passwordLowercase') },
    { key: 'hasNumber', label: t('auth.validation.passwordNumber') },
    { key: 'hasSpecialChar', label: t('auth.validation.passwordSpecial') },
  ] as const

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
      <Modal isOpen={isAddUserModalOpen} onClose={handleCloseModal} title={t('dashboard.admin.addUser')}>
        <form className="modal-form" onSubmit={(e) => { e.preventDefault(); void handleAddUser() }}>
          <div className="form-field">
            <label htmlFor="user-first-name">First Name</label>
            <input
              id="user-first-name"
              type="text"
              value={userFormData.firstName}
              onChange={(e) => handleFieldChange('firstName', e.target.value)}
              className={touchedFields.firstName && userFormErrors.firstName ? 'input-error' : ''}
            />
            {touchedFields.firstName && userFormErrors.firstName && <span className="field-error">{userFormErrors.firstName}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="user-last-name">Last Name</label>
            <input
              id="user-last-name"
              type="text"
              value={userFormData.lastName}
              onChange={(e) => handleFieldChange('lastName', e.target.value)}
              className={touchedFields.lastName && userFormErrors.lastName ? 'input-error' : ''}
            />
            {touchedFields.lastName && userFormErrors.lastName && <span className="field-error">{userFormErrors.lastName}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="user-email">{t('dashboard.form.email')}</label>
            <input
              id="user-email"
              type="email"
              value={userFormData.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              className={touchedFields.email && userFormErrors.email ? 'input-error' : ''}
            />
            {touchedFields.email && userFormErrors.email && <span className="field-error">{userFormErrors.email}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="user-password">{t('dashboard.form.password')}</label>
            <input
              id="user-password"
              type="password"
              value={userFormData.password}
              onChange={(e) => handleFieldChange('password', e.target.value)}
              className={touchedFields.password && userFormErrors.password && Array.isArray(userFormErrors.password) && userFormErrors.password.length > 0 ? 'input-error' : ''}
            />
            {touchedFields.password && userFormData.password && (
              <ul className="field-error-list">
                {passwordRequirements.map((req) => (
                  <li key={req.key} className={passwordValidation[req.key] ? 'requirement-met' : 'requirement-unmet'}>
                    {req.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="user-confirm-password">{t('auth.signin.confirmPassword')}</label>
            <input
              id="user-confirm-password"
              type="password"
              value={userFormData.confirmPassword}
              onChange={(e) => handleFieldChange('confirmPassword', e.target.value)}
              className={touchedFields.confirmPassword && userFormErrors.confirmPassword ? 'input-error' : ''}
            />
            {touchedFields.confirmPassword && userFormErrors.confirmPassword && <span className="field-error">{userFormErrors.confirmPassword}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="user-role">{t('dashboard.form.role')}</label>
            <select
              id="user-role"
              value={userFormData.role}
              onChange={(e) => handleFieldChange('role', e.target.value)}
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
              onChange={(e) => handleFieldChange('department', e.target.value)}
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
              onChange={(e) => handleFieldChange('status', e.target.value)}
            >
              <option value="active">{t('dashboard.admin.statusActive')}</option>
              <option value="archived">{t('dashboard.admin.statusArchived')}</option>
            </select>
          </div>
          {userFormErrors.submit && <p className="form-error">{userFormErrors.submit}</p>}
          <div className="modal-actions">
            <button type="button" className="button button-secondary button-sm" onClick={handleCloseModal}>
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

import { useState, useEffect } from 'react'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { KPICard } from '../components/KPICard'
import { DataTable } from '../components/DataTable'
import { Modal } from '../components/Modal'
import { Skeleton } from '../components/Skeleton'
import { ErrorState } from '../components/ErrorState'
import { BarChart } from '../components/BarChart'
import { DonutChart } from '../components/DonutChart'
import { PieChart } from '../components/PieChart'
import { useDashboardApi } from '../hooks/useDashboardApi'

interface AdminUser {
  id: string
  name: string
  email: string
  status: string
  lastLogin: string | null
}

interface AuditLog {
  id: string
  actor: string
  action: string
  timestamp: string
}

/**
 * Tableau de bord pour le rôle super_admin.
 * Affiche les KPIs globaux, la santé de la plateforme, la gestion des admins et l'activité récente.
 */
export function SuperAdminDashboard() {
  const { t } = useI18n()
  const api = useDashboardApi()

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message.trim()) {
      return error.message
    }

    return t('dashboard.error.load')
  }

  const readNumericValue = (payload: unknown): number => {
    if (typeof payload === 'number') {
      return payload
    }

    if (typeof payload === 'object' && payload !== null) {
      const record = payload as Record<string, unknown>
      const count = record.count
      if (typeof count === 'number') {
        return count
      }

      const value = record.value
      if (typeof value === 'number') {
        return value
      }
    }

    return 0
  }

  const readArrayData = <T,>(payload: { data?: T[] } | T[] | undefined): T[] => {
    if (Array.isArray(payload)) {
      return payload
    }

    return payload?.data ?? []
  }
  
  const [isAddAdminModalOpen, setIsAddAdminModalOpen] = useState(false)
  const [adminFormData, setAdminFormData] = useState({ firstName: '', lastName: '', email: '', password: '', status: 'active' })
  const [adminFormErrors, setAdminFormErrors] = useState<Record<string, string>>({})

  // KPI states
  const [activeInternsCount, setActiveInternsCount] = useState<number | null>(null)
  const [supervisorsCount, setSupervisorsCount] = useState<number | null>(null)
  const [missionsCount, setMissionsCount] = useState<number | null>(null)
  const [adminsCount, setAdminsCount] = useState<number | null>(null)

  // Chart data states
  const [internsByDepartment, setInternsByDepartment] = useState<Array<{ name: string; value: number }>>([])
  const [internshipsByStatus, setInternshipsByStatus] = useState<Array<{ name: string; value: number }>>([])
  const [internshipsByType, setInternshipsByType] = useState<Array<{ name: string; value: number }>>([])

  // Admin users state
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [adminUsersPage, setAdminUsersPage] = useState(1)
  const [adminUsersTotal, setAdminUsersTotal] = useState(0)

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])

  // Loading states
  const [loadingKpis, setLoadingKpis] = useState(true)
  const [loadingCharts, setLoadingCharts] = useState(true)
  const [loadingAdmins, setLoadingAdmins] = useState(true)
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(true)

  // Error states
  const [kpisError, setKpisError] = useState<string | null>(null)
  const [chartsError, setChartsError] = useState<string | null>(null)
  const [adminsError, setAdminsError] = useState<string | null>(null)
  const [auditLogsError, setAuditLogsError] = useState<string | null>(null)

  const loadKpis = async () => {
    setLoadingKpis(true)
    setKpisError(null)
    try {
      const [activeInterns, supervisors, missions, admins] = await Promise.all([
        api.get<{ count?: number } | number>('/api/stats/interns/active'),
        api.get<{ count?: number } | number>('/api/stats/supervisors'),
        api.get<{ count?: number } | number>('/api/stats/missions'),
        api.get<{ count?: number } | number>('/api/stats/admins'),
      ])
      setActiveInternsCount(readNumericValue(activeInterns))
      setSupervisorsCount(readNumericValue(supervisors))
      setMissionsCount(readNumericValue(missions))
      setAdminsCount(readNumericValue(admins))
    } catch (error) {
      setKpisError(getErrorMessage(error))
    } finally {
      setLoadingKpis(false)
    }
  }

  const loadCharts = async () => {
    setLoadingCharts(true)
    setChartsError(null)
    try {
      const [byDept, byStatus, byType] = await Promise.all([
        api.get<{ data?: Array<{ name: string; value: number }> } | Array<{ name: string; value: number }>>('/api/stats/interns-by-department'),
        api.get<{ data?: Array<{ name: string; value: number }> } | Array<{ name: string; value: number }>>('/api/stats/internships-by-status'),
        api.get<{ data?: Array<{ name: string; value: number }> } | Array<{ name: string; value: number }>>('/api/stats/internships-by-type'),
      ])
      setInternsByDepartment(readArrayData(byDept))
      setInternshipsByStatus(readArrayData(byStatus))
      setInternshipsByType(readArrayData(byType))
    } catch (error) {
      setChartsError(getErrorMessage(error))
    } finally {
      setLoadingCharts(false)
    }
  }

  const loadAdminUsers = async (page: number = 1) => {
    setLoadingAdmins(true)
    setAdminsError(null)
    try {
      const result = await api.get<{ data: AdminUser[]; total: number }>(`/api/users?role=admin&page=${page}&limit=10`)
      setAdminUsers(result.data ?? [])
      setAdminUsersTotal(result.total ?? 0)
      setAdminUsersPage(page)
    } catch (error) {
      setAdminsError(getErrorMessage(error))
    } finally {
      setLoadingAdmins(false)
    }
  }

  const loadAuditLogs = async () => {
    setLoadingAuditLogs(true)
    setAuditLogsError(null)
    try {
      const result = await api.get<{ data: AuditLog[] }>('/api/admin/audit-logs?limit=10')
      setAuditLogs(result.data ?? [])
    } catch (error) {
      setAuditLogsError(getErrorMessage(error))
    } finally {
      setLoadingAuditLogs(false)
    }
  }

  useEffect(() => {
    void loadKpis()
    void loadCharts()
    void loadAdminUsers()
    void loadAuditLogs()
  }, [])

  const validateAdminForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!adminFormData.firstName.trim()) errors.firstName = t('dashboard.form.required')
    if (!adminFormData.lastName.trim()) errors.lastName = t('dashboard.form.required')
    if (!adminFormData.email.trim()) errors.email = t('dashboard.form.required')
    if (!adminFormData.password.trim()) errors.password = t('dashboard.form.required')
    setAdminFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleAddAdmin = async () => {
    if (!validateAdminForm()) return
    try {
      await api.post('/api/users', {
        firstName: adminFormData.firstName.trim(),
        lastName: adminFormData.lastName.trim(),
        email: adminFormData.email.trim(),
        password: adminFormData.password,
        status: adminFormData.status,
        role: 'admin',
      })
      setIsAddAdminModalOpen(false)
      setAdminFormData({ firstName: '', lastName: '', email: '', password: '', status: 'active' })
      void loadAdminUsers(adminUsersPage)
    } catch (error) {
      setAdminFormErrors({ submit: getErrorMessage(error) })
    }
  }

  const handleEditAdmin = (adminId: string) => {
    console.log('Edit admin:', adminId)
  }

  const handleDeactivateAdmin = async (adminId: string) => {
    try {
      await api.patch(`/api/users/${adminId}`, { status: 'inactive' })
      void loadAdminUsers(adminUsersPage)
    } catch (error) {
      setAdminsError(getErrorMessage(error))
    }
  }

  const adminTableColumns = [
    { key: 'name', label: t('dashboard.table.name') },
    { key: 'email', label: t('dashboard.table.email') },
    { key: 'status', label: t('dashboard.table.status') },
    { key: 'lastLogin', label: t('dashboard.table.lastLogin') },
    { key: 'actions', label: t('dashboard.table.actions') },
  ]

  const auditLogColumns = [
    { key: 'actor', label: t('dashboard.table.actor') },
    { key: 'action', label: t('dashboard.table.action') },
    { key: 'timestamp', label: t('dashboard.table.timestamp') },
  ]

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1 className="dashboard-title">{t('dashboard.superAdmin.title')}</h1>
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
              <KPICard title={t('dashboard.kpi.activeInterns')} value={activeInternsCount ?? 0} />
              <KPICard title={t('dashboard.kpi.totalSupervisors')} value={supervisorsCount ?? 0} />
              <KPICard title={t('dashboard.kpi.totalMissions')} value={missionsCount ?? 0} />
              <KPICard title={t('dashboard.kpi.totalAdmins')} value={adminsCount ?? 0} />
            </>
          )}
        </div>
      </section>

      {/* Platform Health Charts */}
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">{t('dashboard.superAdmin.platformHealth')}</h2>
        {loadingCharts ? (
          <div className="charts-grid">
            <Skeleton height="300px" />
            <Skeleton height="300px" />
            <Skeleton height="300px" />
          </div>
        ) : chartsError ? (
          <ErrorState message={chartsError} onRetry={loadCharts} />
        ) : (
          <div className="charts-grid">
            <div className="chart-card">
              <h3 className="chart-title">{t('dashboard.superAdmin.internsByDepartment')}</h3>
              <BarChart data={internsByDepartment} />
            </div>
            <div className="chart-card">
              <h3 className="chart-title">{t('dashboard.superAdmin.internshipsByStatus')}</h3>
              <DonutChart data={internshipsByStatus} />
            </div>
            <div className="chart-card">
              <h3 className="chart-title">{t('dashboard.superAdmin.internshipsByType')}</h3>
              <PieChart data={internshipsByType} />
            </div>
          </div>
        )}
      </section>

      {/* Admin Management Panel */}
      <section className="dashboard-section">
        <div className="section-header-row">
          <h2 className="dashboard-section-title">{t('dashboard.superAdmin.adminManagement')}</h2>
          <button className="button button-primary button-sm" onClick={() => setIsAddAdminModalOpen(true)}>
            {t('dashboard.superAdmin.addAdmin')}
          </button>
        </div>
        {loadingAdmins ? (
          <Skeleton height="300px" />
        ) : adminsError ? (
          <ErrorState message={adminsError} onRetry={() => loadAdminUsers(adminUsersPage)} />
        ) : adminUsers.length === 0 ? (
          <p className="empty-state">{t('dashboard.noData')}</p>
        ) : (
          <DataTable
            columns={adminTableColumns}
            data={adminUsers.map((admin) => ({
              ...admin,
              lastLogin: admin.lastLogin ?? '-',
              actions: (
                <div className="table-actions">
                  <button className="action-button" onClick={() => handleEditAdmin(admin.id)}>
                    {t('dashboard.table.edit')}
                  </button>
                  <button className="action-button action-button-danger" onClick={() => handleDeactivateAdmin(admin.id)}>
                    {t('dashboard.table.deactivate')}
                  </button>
                </div>
              ),
            }))}
            page={adminUsersPage}
            totalPages={Math.ceil(adminUsersTotal / 10)}
            onPageChange={loadAdminUsers}
          />
        )}
      </section>

      {/* Recent Activity Feed */}
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">{t('dashboard.superAdmin.recentActivity')}</h2>
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

      {/* System Settings Quick Access */}
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">{t('dashboard.superAdmin.systemSettings')}</h2>
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
          <a href="/settings/statuses" className="settings-link-card">
            {t('dashboard.superAdmin.statuses')}
          </a>
        </div>
      </section>

      {/* Add Admin Modal */}
      <Modal isOpen={isAddAdminModalOpen} onClose={() => setIsAddAdminModalOpen(false)} title={t('dashboard.superAdmin.addAdmin')}>
        <form className="modal-form" onSubmit={(e) => { e.preventDefault(); void handleAddAdmin() }}>
          <div className="form-field">
            <label htmlFor="admin-first-name">First Name</label>
            <input
              id="admin-first-name"
              type="text"
              value={adminFormData.firstName}
              onChange={(e) => setAdminFormData({ ...adminFormData, firstName: e.target.value })}
              className={adminFormErrors.firstName ? 'input-error' : ''}
            />
            {adminFormErrors.firstName && <span className="field-error">{adminFormErrors.firstName}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="admin-last-name">Last Name</label>
            <input
              id="admin-last-name"
              type="text"
              value={adminFormData.lastName}
              onChange={(e) => setAdminFormData({ ...adminFormData, lastName: e.target.value })}
              className={adminFormErrors.lastName ? 'input-error' : ''}
            />
            {adminFormErrors.lastName && <span className="field-error">{adminFormErrors.lastName}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="admin-email">{t('dashboard.form.email')}</label>
            <input
              id="admin-email"
              type="email"
              value={adminFormData.email}
              onChange={(e) => setAdminFormData({ ...adminFormData, email: e.target.value })}
              className={adminFormErrors.email ? 'input-error' : ''}
            />
            {adminFormErrors.email && <span className="field-error">{adminFormErrors.email}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="admin-password">{t('dashboard.form.password')}</label>
            <input
              id="admin-password"
              type="password"
              value={adminFormData.password}
              onChange={(e) => setAdminFormData({ ...adminFormData, password: e.target.value })}
              className={adminFormErrors.password ? 'input-error' : ''}
            />
            {adminFormErrors.password && <span className="field-error">{adminFormErrors.password}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="admin-status">{t('dashboard.form.status')}</label>
            <select
              id="admin-status"
              value={adminFormData.status}
              onChange={(e) => setAdminFormData({ ...adminFormData, status: e.target.value })}
            >
              <option value="active">{t('dashboard.admin.statusActive')}</option>
              <option value="inactive">{t('dashboard.admin.statusArchived')}</option>
            </select>
          </div>
          {adminFormErrors.submit && <p className="form-error">{adminFormErrors.submit}</p>}
          <div className="modal-actions">
            <button type="button" className="button button-secondary button-sm" onClick={() => setIsAddAdminModalOpen(false)}>
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

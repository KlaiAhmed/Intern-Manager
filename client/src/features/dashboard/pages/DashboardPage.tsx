import { useAuth } from '../../../shared/state/AuthContext'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { usePageMetadata } from '../../../shared/seo/usePageMetadata'
import { SuperAdminDashboard } from './SuperAdminDashboard'
import { AdminDashboard } from './AdminDashboard'
import { SupervisorDashboard } from './SupervisorDashboard'
import { InternDashboard } from './InternDashboard'

type DashboardRole = 'super_admin' | 'admin' | 'supervisor' | 'intern'

function normalizeDashboardRole(rawRole: string | undefined): DashboardRole | null {
  if (!rawRole) {
    return null
  }

  const normalized = rawRole.trim().toLowerCase().replace(/[\s-]/g, '_')

  switch (normalized) {
    case 'superadmin':
    case 'super_admin':
      return 'super_admin'
    case 'admin':
    case 'manager':
      return 'admin'
    case 'supervisor':
      return 'supervisor'
    case 'intern':
      return 'intern'
    default:
      return null
  }
}

/**
 * Page de tableau de bord qui affiche une vue différente selon le rôle de l'utilisateur.
 */
export function DashboardPage() {
  const { t } = useI18n()
  const { user } = useAuth()

  usePageMetadata({
    title: t('dashboard.meta.title'),
    description: t('dashboard.meta.description'),
    path: '/dashboard',
  })

  const role = normalizeDashboardRole(user?.role)

  const renderDashboard = () => {
    switch (role) {
      case 'super_admin':
        return <SuperAdminDashboard />
      case 'admin':
        return <AdminDashboard />
      case 'supervisor':
        return <SupervisorDashboard />
      case 'intern':
        return <InternDashboard />
      default:
        return (
          <div className="dashboard-unknown-role">
            <p>{t('dashboard.noData')}</p>
          </div>
        )
    }
  }

  return (
    <main id="main-content" className="dashboard-page" tabIndex={-1}>
      {renderDashboard()}
    </main>
  )
}

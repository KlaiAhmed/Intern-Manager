import { Suspense, lazy, useMemo } from 'react'
import { useAuth } from '../../../stores/AuthContext'
import { useI18n } from '../../../locales/I18nContext'
import { usePageMetadata } from '../../../hooks/usePageMetadata'
import '../styles/dashboard.css'

// Lazy-load dashboard variants - only the user's role dashboard is loaded
const SuperAdminDashboard = lazy(() =>
  import('./SuperAdminDashboard').then((m) => ({ default: m.SuperAdminDashboard })),
)
const AdminDashboard = lazy(() =>
  import('./AdminDashboard').then((m) => ({ default: m.AdminDashboard })),
)
const ManagerDashboard = lazy(() =>
  import('./ManagerDashboard/ManagerDashboard').then((m) => ({ default: m.ManagerDashboard })),
)
const SupervisorDashboard = lazy(() =>
  import('./SupervisorDashboard/index').then((m) => ({ default: m.default })),
)
const InternDashboard = lazy(() =>
  import('./InternDashboard').then((m) => ({ default: m.InternDashboard })),
)

type DashboardRole = 'super_admin' | 'admin' | 'manager' | 'supervisor' | 'intern'

const dashboardComponents = {
  super_admin: SuperAdminDashboard,
  admin: AdminDashboard,
  manager: ManagerDashboard,
  supervisor: SupervisorDashboard,
  intern: InternDashboard,
} as const

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
      return 'admin'
    case 'manager':
      return 'manager'
    case 'supervisor':
      return 'supervisor'
    case 'intern':
      return 'intern'
    default:
      return null
  }
}

/** Loading fallback for dashboard */
function DashboardLoadingFallback() {
  return (
    <main id="main-content" className="dashboard-page" tabIndex={-1}>
      <div className="dashboard-loading">
        <div className="dashboard-loading-spinner" />
      </div>
    </main>
  )
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

  const DashboardComponent = useMemo(() => {
    if (role && role in dashboardComponents) {
      return dashboardComponents[role as DashboardRole]
    }
    return null
  }, [role])

  if (!DashboardComponent) {
    return (
      <main id="main-content" className="dashboard-page" tabIndex={-1}>
        <div className="dashboard-unknown-role">
          <p>{t('dashboard.noData')}</p>
        </div>
      </main>
    )
  }

  return (
    <Suspense fallback={<DashboardLoadingFallback />}>
      <DashboardComponent />
    </Suspense>
  )
}

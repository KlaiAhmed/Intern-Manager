/*
* CODEBASE_AUDIT.md
* Date: 2025-04-01
* Auditor: Claude Code
*
* ## Typography
* - Primary font: 'DM Sans' for headings (500 weight only)
* - Body font: 'IBM Plex Sans' for body text (400 weight)
* - Defined via CSS variables: --dash-font-heading, --dash-font-body
*
* ## Color System
* - Uses semantic CSS variables from index.css and dashboard-tokens.css
* - Surfaces: --dash-bg-primary, --dash-bg-secondary, --dash-bg-tertiary
* - Text: --dash-text, --dash-text-muted (55% opacity light / 50% dark)
* - Accent: --dash-accent (blue), derived from --color-primary
* - Borders: 1px solid at 15% opacity, 30% on hover
* - Status colors: --dash-success, --dash-warning, --dash-error
*
* ## Spacing Scale
* - xs: 0.5rem (8px)
* - sm: 0.75rem (12px)
* - md: 1rem (16px)
* - lg: 1.25rem (20px) - MIN padding for cards
* - xl: 1.5rem (24px)
* - 2xl: 2rem (32px)
* - 3xl: 3rem (48px)
*
* ## Border Radius
* - sm: 0.5rem (8px)
* - md: 0.75rem (12px)
* - lg: 1rem (16px)
*
* ## Animation Timing
* - Fast: 120ms (micro-interactions)
* - Medium: 200ms (content transitions)
* - Slow: 300ms (entry animations)
* - Easing: cubic-bezier(0.4, 0, 0.2, 1)
*
* ## Existing Components
* - DashboardLayout.tsx: Base layout with sidebar
* - StatCard.tsx/css: Metric cards with trend indicators
* - Panel.tsx/css: Section containers
* - Modal.tsx/css: Dialog boxes
* - DataTable.tsx: Paginated tables
* - BarChart.tsx, DonutChart.tsx, PieChart.tsx: CSS-based charts
* - Skeleton.tsx: Loading state with shimmer
* - ErrorState.tsx/css: Error display
*
* ## Design Rules Followed
* - Zero hardcoded hex values - ALL from CSS variables
* - No box-shadow, drop-shadow, or decorative gradients
* - Font-weight 400 for body, 500 for headings only
* - Reduced motion queries on all animations
* - Border 1px solid at 15% opacity
*/

import type { ReactNode } from 'react'
import { Suspense, lazy, useState, useCallback, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useI18n } from '../../../locales/I18nContext'
import { useSuperAdminStats } from '../hooks/useSuperAdminStats'
import type { SuperAdminSection } from '../components/SuperAdminSidebar'
import { SuperAdminStatCard } from '../components/SuperAdminStatCard'
import { UserManagementSection } from '../components/UserManagementSection'
import { SettingsPanel, type SettingsSubSection } from '../components/SettingsPanel'
import { AuditLogSection } from '../components/AuditLogSection'
import { BIPanelSection } from '../components/BIPanelSection'
import { Skeleton } from '../components/Skeleton'
import { ErrorState } from '../components/ErrorState'
import { MissionFeatureFlagsSection } from './AdminDashboard/MissionFeatureFlagsSection'
import {
  DashboardShell,
  OperationalEvaluationsSection,
  OperationalInternshipsSection,
  OperationalInternsSection,
} from '../shared/components'
import '../styles/pages/SuperAdminDashboard.css'

// Lazy-load chart components - only loaded when Overview section renders charts
const BarChart = lazy(() =>
  import('../components/BarChart').then((m) => ({ default: m.BarChart })),
)
const DonutChart = lazy(() =>
  import('../components/DonutChart').then((m) => ({ default: m.DonutChart })),
)

// SVG Icon Component
const Icon = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
)

// Icon definitions
const Icons = {
  Users: () => <Icon>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>,
  User: () => <Icon>
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </Icon>,
  Target: () => <Icon>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </Icon>,
  FolderOpen: () => <Icon>
    <path d="M6 22l2-15h14" />
    <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h12l4 7h2" />
  </Icon>,
  FileCheck: () => <Icon>
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="m9 15 2 2 4-4" />
  </Icon>,
}

const superAdminSections: SuperAdminSection[] = [
  'overview',
  'users',
  'internships',
  'missions',
  'evaluations',
  'settings',
  'audit',
  'biPanel',
]

function isMissionFeatureFlagsRoute(pathname: string): boolean {
  return pathname.startsWith('/dashboard/admin/missions/') && pathname.endsWith('/feature-flags')
}

function isSuperAdminSection(value: unknown): value is SuperAdminSection {
  return typeof value === 'string' && superAdminSections.includes(value as SuperAdminSection)
}

// Chart loading fallback
function ChartFallback() {
  return <Skeleton height="280px" />
}

// Overview Section with KPI cards and charts
function OverviewSection() {
  const { t } = useI18n()
  const { stats, charts, loading, errors, refreshKpis, refreshCharts } = useSuperAdminStats()

  const formatNumber = (n: number | null) =>
    n === null ? '—' : n.toLocaleString()

  return (
    <section className="overview-section">
      {/* Row 1: Primary KPIs (4 cards) */}
      <div className="kpi-row kpi-row-primary">
        {loading.kpis ? (
          <>
            <Skeleton height="140px" />
            <Skeleton height="140px" />
            <Skeleton height="140px" />
            <Skeleton height="140px" />
          </>
        ) : errors.kpis ? (
          <div className="kpi-error-container">
            <ErrorState
              message={errors.kpis}
              onRetry={refreshKpis}
            />
          </div>
        ) : (
          <>
            <SuperAdminStatCard
              label={t('dashboard.kpi.activeInterns')}
              value={formatNumber(stats.activeInterns)}
              icon={<Icons.Users />}
              animationDelay={0}
            />
            <SuperAdminStatCard
              label={t('dashboard.kpi.totalSupervisors')}
              value={formatNumber(stats.activeSupervisors)}
              icon={<Icons.User />}
              animationDelay={60}
            />
            <SuperAdminStatCard
              label={t('dashboard.kpi.totalMissions')}
              value={formatNumber(stats.totalMissions)}
              icon={<Icons.Target />}
              animationDelay={120}
            />
            <SuperAdminStatCard
              label={t('dashboard.kpi.totalAdmins')}
              value={formatNumber(stats.activeAdmins)}
              icon={<Icons.User />}
              animationDelay={180}
            />
          </>
        )}
      </div>

      {/* Row 2: Secondary KPIs (3 cards) */}
      <div className="kpi-row kpi-row-secondary">
        {loading.kpis ? (
          <>
            <Skeleton height="120px" />
            <Skeleton height="120px" />
            <Skeleton height="120px" />
          </>
        ) : (
          <>
            <SuperAdminStatCard
              label={t('dashboard.kpi.totalInterns')}
              value={formatNumber(stats.totalInterns)}
              icon={<Icons.Users />}
              variant="default"
              animationDelay={240}
            />
            <SuperAdminStatCard
              label={t('dashboard.kpi.activeInternships')}
              value={formatNumber(stats.activeInternships)}
              icon={<Icons.FolderOpen />}
              variant="primary"
              animationDelay={300}
            />
            <SuperAdminStatCard
              label={t('dashboard.kpi.pendingDeliverables')}
              value={formatNumber(stats.pendingDeliverables)}
              icon={<Icons.FileCheck />}
              variant="warning"
              animationDelay={360}
            />
          </>
        )}
      </div>

      {/* Row 3: Charts */}
      <div className="charts-row">
        <h2 className="section-title charts-title">{t('dashboard.section.analytics')}</h2>
        <div className="charts-grid">
          {loading.charts ? (
            <>
              <Skeleton height="320px" />
              <Skeleton height="320px" />
              <Skeleton height="320px" />
            </>
          ) : errors.charts ? (
            <div className="charts-error-container">
              <ErrorState
                message={errors.charts}
                onRetry={refreshCharts}
              />
            </div>
          ) : (
            <>
              <div className="chart-card chart-card-delay-150">
                <h3 className="chart-title">{t('dashboard.chart.internsByDepartment')}</h3>
                <div className="chart-content">
                  <Suspense fallback={<ChartFallback />}>
                    <BarChart data={charts.internsByDepartment} />
                  </Suspense>
                </div>
              </div>
              <div className="chart-card chart-card-delay-210">
                <h3 className="chart-title">{t('dashboard.chart.internshipsByStatus')}</h3>
                <div className="chart-content">
                  <Suspense fallback={<ChartFallback />}>
                    <DonutChart data={charts.internshipsByStatus} />
                  </Suspense>
                </div>
              </div>
              <div className="chart-card chart-card-delay-270">
                <h3 className="chart-title">{t('dashboard.chart.internshipsByType')}</h3>
                <div className="chart-content">
                  <Suspense fallback={<ChartFallback />}>
                    <BarChart data={charts.internshipsByType} />
                  </Suspense>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

// Main Dashboard Component
export function SuperAdminDashboard() {
  const { t } = useI18n()
  const location = useLocation()
  const navigate = useNavigate()
  const { missionId } = useParams<{ missionId?: string }>()
  const featureFlagsRoute = isMissionFeatureFlagsRoute(location.pathname)
  const locationState = location.state as { activeSection?: unknown } | null
  const [activeSection, setActiveSection] = useState<SuperAdminSection>(() => {
    if (featureFlagsRoute) {
      return 'internships'
    }

    if (isSuperAdminSection(locationState?.activeSection)) {
      return locationState.activeSection
    }

    return 'overview'
  })
  const [activeSettingsSubSection, setActiveSettingsSubSection] = useState<SettingsSubSection>('departments')

  const resolvedActiveSection = featureFlagsRoute ? 'internships' : activeSection

  const pageTitle = useMemo(() => {
    if (featureFlagsRoute) {
      return 'Mission Feature Controls'
    }

    switch (activeSection) {
      case 'overview':
        return t('dashboard.superAdmin.title')
      case 'users':
        return 'User Management'
      case 'internships':
        return 'Internships'
      case 'missions':
        return 'Interns Management'
      case 'evaluations':
        return 'Evaluations'
      case 'settings':
        return 'Referential Settings'
      case 'audit':
        return 'Audit & Security'
      case 'biPanel':
        return 'BI Panel'
      default:
        return t('dashboard.superAdmin.title')
    }
  }, [activeSection, featureFlagsRoute, t])

  const handleSectionChange = useCallback((nextSection: SuperAdminSection) => {
    setActiveSection(nextSection)

    if (featureFlagsRoute) {
      navigate('/dashboard', { state: { activeSection: nextSection } })
    }
  }, [featureFlagsRoute, navigate])

  const renderContent = useCallback(() => {
    if (featureFlagsRoute) {
      if (!missionId) {
        return (
          <ErrorState
            message="Mission id is missing in the current route."
            onRetry={() => {
              navigate('/dashboard', { state: { activeSection: 'internships' } })
            }}
          />
        )
      }

      return (
        <MissionFeatureFlagsSection
          missionId={missionId}
          onBack={() => {
            setActiveSection('internships')
            navigate('/dashboard', { state: { activeSection: 'internships' } })
          }}
        />
      )
    }

    switch (activeSection) {
      case 'overview':
        return <OverviewSection />
      case 'users':
        return <UserManagementSection />
      case 'internships':
        return <OperationalInternshipsSection />
      case 'missions':
        return <OperationalInternsSection />
      case 'evaluations':
        return <OperationalEvaluationsSection />
      case 'settings':
        return (
          <SettingsPanel
            activeSubSection={activeSettingsSubSection}
            onSubSectionChange={setActiveSettingsSubSection}
          />
        )
      case 'audit':
        return <AuditLogSection />
      case 'biPanel':
        return <BIPanelSection />
      default:
        return <OverviewSection />
    }
  }, [activeSection, activeSettingsSubSection, featureFlagsRoute, missionId, navigate])

  return (
    <DashboardShell
      activeSection={resolvedActiveSection}
      onSectionChange={handleSectionChange}
      onSettingsSubSectionChange={setActiveSettingsSubSection}
      pageTitle={pageTitle}
      contentKey={featureFlagsRoute ? location.pathname : activeSection}
    >
      {renderContent()}
    </DashboardShell>
  )
}

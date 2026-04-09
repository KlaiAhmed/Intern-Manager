import { FileCheck, FolderOpen, User, Users } from '../../components/IconComponents'
import { ErrorState } from '../../components/ErrorState'
import { Skeleton } from '../../components/Skeleton'
import { SuperAdminStatCard } from '../../components/SuperAdminStatCard'
import { useAdminOverviewStats } from '../../shared/hooks/useAdminOverviewStats'
import { useI18n } from '../../../../locales/I18nContext'

function ChartPlaceholder({ title, endpoint }: { title: string; endpoint: string }) {
  return (
    <div className="chart-card admin-endpoint-placeholder-card">
      <h3 className="chart-title">{title}</h3>
      <p className="admin-endpoint-placeholder-title">Endpoint not yet available for Admin role.</p>
      <p className="admin-endpoint-placeholder-text">Blocked endpoint: {endpoint}</p>
    </div>
  )
}

export function AdminOverviewSection() {
  const { t } = useI18n()
  const { stats, loading, error, refresh } = useAdminOverviewStats()

  const totalInterns = error ? '-' : stats.totalInterns.toLocaleString()
  const activeInternships = error ? '-' : stats.activeInternships.toLocaleString()
  const totalSupervisors = error ? '-' : stats.totalSupervisors.toLocaleString()
  const pendingDeliverables = error ? '-' : stats.pendingDeliverables.toLocaleString()

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
            <ErrorState message={error} onRetry={() => void refresh()} />
          </div>
        ) : (
          <>
            <SuperAdminStatCard
              label={t('dashboard.kpi.totalInterns')}
              value={totalInterns}
              icon={<Users />}
              animationDelay={0}
            />
            <SuperAdminStatCard
              label={t('dashboard.kpi.totalSupervisors')}
              value={totalSupervisors}
              icon={<User />}
              animationDelay={60}
            />
            <SuperAdminStatCard
              label={t('dashboard.kpi.activeInternships')}
              value={activeInternships}
              icon={<FolderOpen />}
              animationDelay={120}
            />
            <SuperAdminStatCard
              label={t('dashboard.kpi.pendingDeliverables')}
              value={pendingDeliverables}
              icon={<FileCheck />}
              variant="warning"
              animationDelay={180}
            />
          </>
        )}
      </div>

      <div className="kpi-row kpi-row-secondary">
        {loading ? (
          <>
            <Skeleton height="120px" />
            <Skeleton height="120px" />
            <Skeleton height="120px" />
          </>
        ) : (
          <>
            <SuperAdminStatCard
              label={t('dashboard.kpi.totalInterns')}
              value={totalInterns}
              icon={<Users />}
              variant="default"
              animationDelay={240}
            />
            <SuperAdminStatCard
              label={t('dashboard.kpi.activeInternships')}
              value={activeInternships}
              icon={<FolderOpen />}
              variant="primary"
              animationDelay={300}
            />
            <SuperAdminStatCard
              label={t('dashboard.kpi.pendingDeliverables')}
              value={pendingDeliverables}
              icon={<FileCheck />}
              variant="warning"
              animationDelay={360}
            />
          </>
        )}
      </div>

      <div className="charts-row">
        <h2 className="section-title charts-title">{t('dashboard.section.analytics')}</h2>
        <div className="charts-grid">
          <ChartPlaceholder
            title={t('dashboard.chart.internsByDepartment')}
            endpoint="GET /api/stats/interns-by-department"
          />
          <ChartPlaceholder
            title={t('dashboard.chart.internshipsByStatus')}
            endpoint="GET /api/stats/internships-by-status"
          />
          <ChartPlaceholder
            title={t('dashboard.chart.internshipsByType')}
            endpoint="GET /api/stats/internships-by-type"
          />
        </div>
      </div>
    </section>
  )
}

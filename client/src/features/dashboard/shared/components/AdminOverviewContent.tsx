import { lazy, Suspense, type ReactNode } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { FileCheck, FolderOpen, Target, User, Users } from '../../components/IconComponents'
import { ErrorState } from '../../components/ErrorState'
import { Skeleton } from '../../components/Skeleton'
import { SuperAdminStatCard } from '../../components/SuperAdminStatCard'
import { useAdminOverviewStats } from '../hooks/useAdminOverviewStats'

const BarChart = lazy(() =>
  import('../../components/BarChart').then((module) => ({ default: module.BarChart })),
)

const DonutChart = lazy(() =>
  import('../../components/DonutChart').then((module) => ({ default: module.DonutChart })),
)

function ChartFallback() {
  return <Skeleton height="280px" />
}

function ChartPanel({
  title,
  animationClassName,
  children,
}: {
  title: string
  animationClassName: string
  children: ReactNode
}) {
  return (
    <div className={`chart-card ${animationClassName}`}>
      <h3 className="chart-title">{title}</h3>
      <div className="chart-content">{children}</div>
    </div>
  )
}

export function AdminOverviewContent() {
  const { t } = useI18n()
  const { stats, charts, loading, errors, refreshKpis, refreshCharts } = useAdminOverviewStats()

  const formatNumber = (value: number): string => value.toLocaleString()

  return (
    <>
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
            <ErrorState message={errors.kpis} onRetry={() => void refreshKpis()} />
          </div>
        ) : (
          <>
            <SuperAdminStatCard
              label={t('dashboard.kpi.activeInterns')}
              value={formatNumber(stats.activeInterns)}
              icon={<Users />}
              animationDelay={0}
            />
            <SuperAdminStatCard
              label={t('dashboard.kpi.totalSupervisors')}
              value={formatNumber(stats.activeSupervisors)}
              icon={<User />}
              animationDelay={60}
            />
            <SuperAdminStatCard
              label={t('dashboard.kpi.totalMissions')}
              value={formatNumber(stats.totalMissions)}
              icon={<Target />}
              animationDelay={120}
            />
            <SuperAdminStatCard
              label={t('dashboard.kpi.totalAdmins')}
              value={formatNumber(stats.activeAdmins)}
              icon={<User />}
              animationDelay={180}
            />
          </>
        )}
      </div>

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
              icon={<Users />}
              variant="default"
              animationDelay={240}
            />
            <SuperAdminStatCard
              label={t('dashboard.kpi.activeInternships')}
              value={formatNumber(stats.activeInternships)}
              icon={<FolderOpen />}
              variant="primary"
              animationDelay={300}
            />
            <SuperAdminStatCard
              label={t('dashboard.kpi.pendingDeliverables')}
              value={formatNumber(stats.pendingDeliverables)}
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
          {loading.charts ? (
            <>
              <Skeleton height="320px" />
              <Skeleton height="320px" />
              <Skeleton height="320px" />
            </>
          ) : errors.charts ? (
            <div className="charts-error-container">
              <ErrorState message={errors.charts} onRetry={() => void refreshCharts()} />
            </div>
          ) : (
            <>
              <ChartPanel title={t('dashboard.chart.internsByDepartment')} animationClassName="chart-card-delay-150">
                <Suspense fallback={<ChartFallback />}>
                  <BarChart data={charts.internsByDepartment} />
                </Suspense>
              </ChartPanel>
              <ChartPanel title={t('dashboard.chart.internshipsByStatus')} animationClassName="chart-card-delay-210">
                <Suspense fallback={<ChartFallback />}>
                  <DonutChart data={charts.internshipsByStatus} />
                </Suspense>
              </ChartPanel>
              <ChartPanel title={t('dashboard.chart.internshipsByType')} animationClassName="chart-card-delay-270">
                <Suspense fallback={<ChartFallback />}>
                  <BarChart data={charts.internshipsByType} />
                </Suspense>
              </ChartPanel>
            </>
          )}
        </div>
      </div>
    </>
  )
}
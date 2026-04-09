import { FileCheck, FolderOpen, User, Users } from '../../components/IconComponents'
import { ErrorState } from '../../components/ErrorState'
import { Skeleton } from '../../components/Skeleton'
import { SuperAdminStatCard } from '../../components/SuperAdminStatCard'
import { useAdminOverviewStats } from '../hooks/useAdminOverviewStats'
import styles from './OperationalOverviewSection.module.css'

export function OperationalOverviewSection() {
  const { stats, loading, error, refresh } = useAdminOverviewStats()

  return (
    <section className={`${styles.root} overview-section admin-view-section`} id="section-overview">
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
              label="Total Interns"
              value={stats.totalInterns.toLocaleString()}
              icon={<Users />}
              animationDelay={0}
            />
            <SuperAdminStatCard
              label="Active Internships"
              value={stats.activeInternships.toLocaleString()}
              icon={<FolderOpen />}
              variant="primary"
              animationDelay={60}
            />
            <SuperAdminStatCard
              label="Total Supervisors"
              value={stats.totalSupervisors.toLocaleString()}
              icon={<User />}
              animationDelay={120}
            />
            <SuperAdminStatCard
              label="Pending Deliverables"
              value={stats.pendingDeliverables.toLocaleString()}
              icon={<FileCheck />}
              variant="warning"
              animationDelay={180}
            />
          </>
        )}
      </div>

      <div className="charts-row">
        <h2 className="section-title charts-title">Analytics</h2>
        <div className="charts-grid">
          <div className="chart-card admin-endpoint-placeholder-card">
            <h3 className="chart-title">Interns by Department</h3>
            <p className="admin-endpoint-placeholder-title">Endpoint not yet available for Admin role.</p>
            <p className="admin-endpoint-placeholder-text">Blocked endpoint: GET /api/stats/interns-by-department</p>
          </div>

          <div className="chart-card admin-endpoint-placeholder-card">
            <h3 className="chart-title">Internships by Status</h3>
            <p className="admin-endpoint-placeholder-title">Endpoint not yet available for Admin role.</p>
            <p className="admin-endpoint-placeholder-text">Blocked endpoint: GET /api/stats/internships-by-status</p>
          </div>

          <div className="chart-card admin-endpoint-placeholder-card">
            <h3 className="chart-title">Internships by Type</h3>
            <p className="admin-endpoint-placeholder-title">Endpoint not yet available for Admin role.</p>
            <p className="admin-endpoint-placeholder-text">Blocked endpoint: GET /api/stats/internships-by-type</p>
          </div>
        </div>
      </div>
    </section>
  )
}

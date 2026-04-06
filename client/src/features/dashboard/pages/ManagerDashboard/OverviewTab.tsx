import { ErrorState } from '../../components/ErrorState'
import { Panel } from '../../components/Panel'
import { Skeleton } from '../../components/Skeleton'
import { StatCard } from '../../components/StatCard'
import type { Activity, Department } from './types'

interface OverviewTabProps {
  loadingKPIs: boolean
  loadingDepartments: boolean
  loadingActivity: boolean
  kpisError: string | null
  departmentsError: string | null
  activityError: string | null
  internsCount: number
  activeMissionsCount: number
  avgCompletion: number
  pendingReviews: number
  departments: Department[]
  activities: Activity[]
  loadKPIs: () => Promise<void>
  loadDepartments: () => Promise<void>
  loadActivity: () => Promise<void>
  getActivityIcon: (type: Activity['type']) => string
  formatActivityDate: (dateString: string) => string
}

export function OverviewTab({
  loadingKPIs,
  loadingDepartments,
  loadingActivity,
  kpisError,
  departmentsError,
  activityError,
  internsCount,
  activeMissionsCount,
  avgCompletion,
  pendingReviews,
  departments,
  activities,
  loadKPIs,
  loadDepartments,
  loadActivity,
  getActivityIcon,
  formatActivityDate,
}: OverviewTabProps) {
  return (
    <div className="dash-section" role="tabpanel" id="tabpanel-overview" aria-labelledby="tab-overview">
      <div className="dash-stats-row">
        {loadingKPIs ? (
          <>
            <Skeleton height="120px" />
            <Skeleton height="120px" />
            <Skeleton height="120px" />
            <Skeleton height="120px" />
          </>
        ) : kpisError ? (
          <ErrorState message={kpisError} onRetry={loadKPIs} />
        ) : (
          <>
            <StatCard label="Total interns" value={internsCount.toLocaleString()} />
            <StatCard label="Active missions" value={activeMissionsCount.toLocaleString()} />
            <StatCard label="Avg completion" value={`${avgCompletion}%`} />
            <StatCard label="Pending reviews" value={pendingReviews.toLocaleString()} />
          </>
        )}
      </div>

      <div className="dash-two-cols">
        <Panel title="Department progress">
          {loadingDepartments ? (
            <Skeleton height="200px" />
          ) : departmentsError ? (
            <ErrorState message={departmentsError} onRetry={loadDepartments} />
          ) : departments.length === 0 ? (
            <div className="dash-empty">
              <div className="dash-empty-icon">∅</div>
              <h3 className="dash-empty-title">No departments</h3>
              <p className="dash-empty-description">No departments configured yet.</p>
            </div>
          ) : (
            <div className="dept-list">
              {departments.map((department) => (
                <div key={department.id} className="dept-item">
                  <div className="dept-info">
                    <span className="dept-name">{department.name}</span>
                    <span className="dept-meta">{department.internCount} interns, {department.supervisorCount} supervisors</span>
                  </div>
                  <div className="dept-progress">
                    <div className="dash-progress">
                      <div className="dash-progress-fill" style={{ width: `${department.avgProgress}%` }} />
                    </div>
                    <span className="dept-progress-value">{department.avgProgress}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Recent activity">
          {loadingActivity ? (
            <Skeleton height="200px" />
          ) : activityError ? (
            <ErrorState message={activityError} onRetry={loadActivity} />
          ) : activities.length === 0 ? (
            <div className="dash-empty">
              <div className="dash-empty-icon">⟳</div>
              <h3 className="dash-empty-title">No recent activity</h3>
              <p className="dash-empty-description">Activity logs will appear here.</p>
            </div>
          ) : (
            <div className="activity-list">
              {activities.map((activity) => (
                <div key={activity.id} className="activity-item">
                  <span className={`activity-icon activity-icon-${activity.type}`} aria-hidden="true">
                    {getActivityIcon(activity.type)}
                  </span>
                  <div className="activity-content">
                    <p className="activity-description">
                      <strong>{activity.actor}</strong> {activity.description}
                    </p>
                    <span className="activity-time">{formatActivityDate(activity.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}

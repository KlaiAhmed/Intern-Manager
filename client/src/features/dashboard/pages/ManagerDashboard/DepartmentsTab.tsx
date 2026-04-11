import { useI18n } from '../../../../locales/I18nContext'
import { ErrorState } from '../../components/ErrorState'
import { Panel } from '../../components/Panel'
import { Skeleton } from '../../components/Skeleton'
import type { Department } from './types'

interface DepartmentsTabProps {
  loadingDepartments: boolean
  departmentsError: string | null
  departments: Department[]
  loadDepartments: () => Promise<void>
}

export function DepartmentsTab({
  loadingDepartments,
  departmentsError,
  departments,
  loadDepartments,
}: DepartmentsTabProps) {
  const { t } = useI18n()
  return (
    <div className="dash-section" role="tabpanel" id="tabpanel-departments" aria-labelledby="tab-departments">
      <Panel title={t('dashboard.manager.departments.title')}>
        {loadingDepartments ? (
          <div className="dash-grid dash-grid-3">
            <Skeleton height="160px" />
            <Skeleton height="160px" />
            <Skeleton height="160px" />
          </div>
        ) : departmentsError ? (
          <ErrorState message={departmentsError} onRetry={loadDepartments} />
        ) : departments.length === 0 ? (
          <div className="dash-empty">
            <div className="dash-empty-icon">∅</div>
            <h3 className="dash-empty-title">{t('dashboard.manager.departments.empty')}</h3>
            <p className="dash-empty-description">{t('dashboard.manager.departments.emptyDesc')}</p>
          </div>
        ) : (
          <div className="dash-grid dash-grid-3">
            {departments.map((department) => (
              <div key={department.id} className="dept-card">
                <div className="dept-card-header">
                  <h3 className="dept-card-name">{department.name}</h3>
                  <div className="dept-ring">
                    <svg viewBox="0 0 36 36" className="dept-ring-svg">
                      <path
                        className="dept-ring-bg"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="dept-ring-fill"
                        strokeDasharray={`${department.avgProgress}, 100`}
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="dept-ring-value">{department.avgProgress}%</span>
                  </div>
                </div>
                <div className="dept-card-stats">
                  <div className="dept-stat">
                    <span className="dept-stat-value">{department.internCount}</span>
                    <span className="dept-stat-label">{t('dashboard.manager.departments.interns')}</span>
                  </div>
                  <div className="dept-stat">
                    <span className="dept-stat-value">{department.supervisorCount}</span>
                    <span className="dept-stat-label">{t('dashboard.manager.departments.supervisors')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}

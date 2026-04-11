import { useI18n } from '../../../../locales/I18nContext'
import { ErrorState } from '../../components/ErrorState'
import { Panel } from '../../components/Panel'
import { Skeleton } from '../../components/Skeleton'
import type { Supervisor } from './types'

interface SupervisorsTabProps {
  loadingSupervisors: boolean
  supervisorsError: string | null
  supervisors: Supervisor[]
  getInitials: (name: string) => string
  loadSupervisors: () => Promise<void>
}

export function SupervisorsTab({
  loadingSupervisors,
  supervisorsError,
  supervisors,
  getInitials,
  loadSupervisors,
}: SupervisorsTabProps) {
  const { t } = useI18n()
  return (
    <div className="dash-section" role="tabpanel" id="tabpanel-supervisors" aria-labelledby="tab-supervisors">
      <Panel title={t('dashboard.manager.supervisors.title')}>
        {loadingSupervisors ? (
          <div className="dash-grid dash-grid-auto">
            <Skeleton height="120px" />
            <Skeleton height="120px" />
            <Skeleton height="120px" />
          </div>
        ) : supervisorsError ? (
          <ErrorState message={supervisorsError} onRetry={loadSupervisors} />
        ) : supervisors.length === 0 ? (
          <div className="dash-empty">
            <div className="dash-empty-icon">∅</div>
            <h3 className="dash-empty-title">{t('dashboard.manager.supervisors.empty')}</h3>
            <p className="dash-empty-description">{t('dashboard.manager.supervisors.emptyDesc')}</p>
          </div>
        ) : (
          <div className="dash-grid dash-grid-3">
            {supervisors.map((supervisor) => (
              <div key={supervisor.id} className="supervisor-card">
                <div className="supervisor-header">
                  <span className="supervisor-avatar" aria-hidden="true">{getInitials(supervisor.name)}</span>
                  <div className="supervisor-meta">
                    <span className="supervisor-name">{supervisor.name}</span>
                    <span className="supervisor-department">{supervisor.department || t('dashboard.manager.supervisors.noDepartment')}</span>
                  </div>
                </div>
                <div className="supervisor-stats">
                  <div className="supervisor-stat">
                    <span className="supervisor-stat-value">{supervisor.activeInternsCount}</span>
                    <span className="supervisor-stat-label">{t('dashboard.manager.supervisors.activeInterns')}</span>
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

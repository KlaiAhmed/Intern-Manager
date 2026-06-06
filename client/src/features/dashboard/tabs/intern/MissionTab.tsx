import type { Internship, TranslateFn } from '../../types/internDashboard'
import type { DashboardCard, MissionCardConfig } from '../../types/missionFeatureFlags'
import { InternTabEmpty, InternTabError, InternTabLoading } from './InternTabStates'

interface MissionTabProps {
  internship: Internship | null
  loading: boolean
  error: string | null
  missionFlags: MissionCardConfig | null
  flagsLoading: boolean
  flagsError: string | null
  onRetry: () => void
  t: TranslateFn
}

const featureCards: Array<{ card: DashboardCard; labelKey: string }> = [
  { card: 'missionOverview', labelKey: 'dashboard.intern.tabs.mission' },
  { card: 'tasks', labelKey: 'dashboard.intern.tabs.tasks' },
  { card: 'deliverables', labelKey: 'dashboard.intern.tabs.deliverables' },
  { card: 'meeting', labelKey: 'dashboard.intern.tabs.meetings' },
]

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

export function MissionTab({
  internship,
  loading,
  error,
  missionFlags,
  flagsLoading,
  flagsError,
  onRetry,
  t,
}: MissionTabProps) {
  if (loading || flagsLoading) {
    return <InternTabLoading label={t('dashboard.intern.tabs.loading')} />
  }

  if (error) {
    return (
      <InternTabError
        title={t('dashboard.intern.tabs.errorTitle')}
        message={error}
        retryLabel={t('dashboard.intern.error.retry')}
        onRetry={onRetry}
      />
    )
  }

  if (!internship?.missionTitle) {
    return (
      <InternTabEmpty
        title={t('dashboard.intern.mission.emptyTitle')}
        message={t('dashboard.intern.mission.emptyMessage')}
      />
    )
  }

  return (
    <div className="intern-tab-stack">
      <section className="intern-panel">
        <div className="intern-section-header">
          <div>
            <p className="intern-eyebrow">{t('dashboard.intern.mission.details')}</p>
            <h2>{internship.missionTitle}</h2>
          </div>
          <span className="intern-status-pill">{internship.status}</span>
        </div>

        <dl className="intern-detail-list intern-detail-list-wide">
          <div>
            <dt>{t('dashboard.intern.mission.supervisor')}</dt>
            <dd>{internship.supervisorName || '-'}</dd>
          </div>
          {internship.coSupervisorName && (
            <div>
              <dt>{t('dashboard.intern.mission.coSupervisor')}</dt>
              <dd>{internship.coSupervisorName}</dd>
            </div>
          )}
          <div>
            <dt>{t('dashboard.intern.mission.department')}</dt>
            <dd>{internship.department || '-'}</dd>
          </div>
          <div>
            <dt>{t('dashboard.intern.mission.startDate')}</dt>
            <dd>{formatDate(internship.startDate)}</dd>
          </div>
          <div>
            <dt>{t('dashboard.intern.mission.endDate')}</dt>
            <dd>{formatDate(internship.endDate)}</dd>
          </div>
          <div>
            <dt>{t('dashboard.intern.mission.progress')}</dt>
            <dd>{internship.progress}%</dd>
          </div>
        </dl>
      </section>

      <section className="intern-panel">
        <div className="intern-section-header">
          <div>
            <p className="intern-eyebrow">{t('dashboard.intern.mission.featureFlags')}</p>
            <h3>{t('dashboard.intern.mission.availableSections')}</h3>
          </div>
        </div>

        {flagsError && <p className="intern-inline-error">{flagsError}</p>}

        <div className="intern-feature-grid">
          {featureCards.map(({ card, labelKey }) => {
            const config = missionFlags?.[card]
            const isVisible = config?.isVisible ?? true
            const isInteractive = config?.isInteractive ?? true

            return (
              <article key={card} className="intern-feature-row">
                <div>
                  <strong>{t(labelKey)}</strong>
                  <span>{isVisible ? t('dashboard.intern.mission.visible') : t('dashboard.intern.mission.hidden')}</span>
                </div>
                <span className={`intern-status-pill ${isInteractive ? '' : 'is-muted'}`.trim()}>
                  {isInteractive ? t('dashboard.intern.mission.interactive') : t('dashboard.intern.mission.readOnly')}
                </span>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}

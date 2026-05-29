import { useInternDeliverables } from '../../hooks/intern/useInternDeliverables'
import { useInternEvaluations } from '../../hooks/intern/useInternEvaluations'
import { useInternJournal } from '../../hooks/intern/useInternJournal'
import { useInternMeetings } from '../../hooks/intern/useInternMeetings'
import { useInternTasks } from '../../hooks/intern/useInternTasks'
import { toErrorMessage } from '../../shared/utils/errorMessage'
import type {
  InternDashboardTabVisibility,
  Internship,
  TranslateFn,
} from '../../types/internDashboard'
import { InternTabEmpty, InternTabError, InternTabLoading } from './InternTabStates'

interface OverviewTabProps {
  internship: Internship | null
  loadingInternship: boolean
  internshipError: string | null
  visibility: InternDashboardTabVisibility
  onRetryInternship: () => void
  t: TranslateFn
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

export function OverviewTab({
  internship,
  loadingInternship,
  internshipError,
  visibility,
  onRetryInternship,
  t,
}: OverviewTabProps) {
  const tasksState = useInternTasks({ enabled: visibility.deliverables })
  const deliverablesState = useInternDeliverables({ enabled: visibility.deliverables })
  const journalState = useInternJournal({ enabled: visibility.journal, limit: 3 })
  const evaluationsState = useInternEvaluations({ enabled: visibility.evaluations, pageSize: 5 })
  const meetingsState = useInternMeetings({ enabled: visibility.meetings, upcoming: true, limit: 3 })

  const tabError =
    tasksState.tasksQuery.error ??
    deliverablesState.deliverablesQuery.error ??
    journalState.journalQuery.error ??
    evaluationsState.evaluationsQuery.error ??
    meetingsState.meetingsQuery.error ??
    null

  const reload = () => {
    void Promise.all([
      tasksState.refetch(),
      deliverablesState.refetch(),
      journalState.refetch(),
      evaluationsState.refetch(),
      meetingsState.refetch(),
    ])
  }

  if (
    loadingInternship ||
    tasksState.isLoading ||
    deliverablesState.isLoading ||
    journalState.isLoading ||
    evaluationsState.isLoading ||
    meetingsState.isLoading
  ) {
    return <InternTabLoading label={t('dashboard.intern.tabs.loading')} />
  }

  if (internshipError || tabError) {
    return (
      <InternTabError
        title={t('dashboard.intern.tabs.errorTitle')}
        message={internshipError ?? toErrorMessage(tabError, t('dashboard.intern.tabs.errorMessage'))}
        retryLabel={t('dashboard.intern.error.retry')}
        onRetry={() => {
          onRetryInternship()
          reload()
        }}
      />
    )
  }

  const completedTasks = tasksState.tasks.filter((task) => task.completed).length
  const submittedDeliverables = deliverablesState.deliverables.filter((deliverable) => deliverable.status !== 'not_submitted').length
  const hasContent = Boolean(
    internship?.missionTitle ||
    tasksState.tasks.length ||
    deliverablesState.deliverables.length ||
    journalState.entries.length ||
    evaluationsState.evaluations.length ||
    meetingsState.meetings.length,
  )

  if (!hasContent) {
    return (
      <InternTabEmpty
        title={t('dashboard.intern.redesign.empty.title')}
        message={t('dashboard.intern.redesign.empty.message')}
      />
    )
  }

  return (
    <div className="intern-tab-stack">
      <section className="intern-panel intern-overview-hero">
        <div>
          <p className="intern-eyebrow">{t('dashboard.intern.overview.currentMission')}</p>
          <h2>{internship?.missionTitle || t('dashboard.intern.overview.noMissionTitle')}</h2>
          <p>{t('dashboard.intern.overview.supervisor', { name: internship?.supervisorName || '-' })}</p>
        </div>
        <div className="intern-progress-block">
          <span>{t('dashboard.intern.overview.progress')}</span>
          <strong>{internship?.progress ?? 0}%</strong>
          <div className="intern-progress-track" aria-hidden="true">
            <div className="intern-progress-fill" style={{ width: `${internship?.progress ?? 0}%` }} />
          </div>
        </div>
      </section>

      <section className="intern-stat-grid" aria-label={t('dashboard.intern.tabs.overview')}>
        <article className="intern-stat-card">
          <span>{t('dashboard.intern.overview.tasksDone')}</span>
          <strong>{completedTasks}/{tasksState.tasks.length}</strong>
        </article>
        <article className="intern-stat-card">
          <span>{t('dashboard.intern.overview.deliverablesSubmitted')}</span>
          <strong>{submittedDeliverables}/{deliverablesState.deliverables.length}</strong>
        </article>
        <article className="intern-stat-card">
          <span>{t('dashboard.intern.overview.evaluationsReleased')}</span>
          <strong>{evaluationsState.evaluations.length}</strong>
        </article>
        <article className="intern-stat-card">
          <span>{t('dashboard.intern.overview.upcomingMeetings')}</span>
          <strong>{meetingsState.meetings.length}</strong>
        </article>
      </section>

      <div className="intern-two-column">
        <section className="intern-panel">
          <div className="intern-section-header">
            <h3>{t('dashboard.intern.overview.timeline')}</h3>
          </div>
          <dl className="intern-detail-list">
            <div>
              <dt>{t('dashboard.intern.mission.startDate')}</dt>
              <dd>{formatDate(internship?.startDate)}</dd>
            </div>
            <div>
              <dt>{t('dashboard.intern.mission.endDate')}</dt>
              <dd>{formatDate(internship?.endDate)}</dd>
            </div>
            <div>
              <dt>{t('dashboard.intern.mission.department')}</dt>
              <dd>{internship?.department || '-'}</dd>
            </div>
          </dl>
        </section>

        <section className="intern-panel">
          <div className="intern-section-header">
            <h3>{t('dashboard.intern.overview.recentJournal')}</h3>
          </div>
          {journalState.entries.length > 0 ? (
            <ul className="intern-plain-list">
              {journalState.entries.map((entry) => (
                <li key={entry.id}>
                  <span>{formatDate(entry.createdAt)}</span>
                  <p>{entry.content}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="intern-muted">{t('dashboard.intern.journal.empty')}</p>
          )}
        </section>
      </div>
    </div>
  )
}

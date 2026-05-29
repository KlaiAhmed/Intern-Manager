import { useInternMeetings } from '../../hooks/intern/useInternMeetings'
import { toErrorMessage } from '../../shared/utils/errorMessage'
import type { TranslateFn } from '../../types/internDashboard'
import { InternTabEmpty, InternTabError, InternTabLoading } from './InternTabStates'

interface MeetingsTabProps {
  t: TranslateFn
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function MeetingsTab({ t }: MeetingsTabProps) {
  const { meetings, isLoading, error, refetch } = useInternMeetings({ upcoming: true, limit: 20 })

  if (isLoading) {
    return <InternTabLoading label={t('dashboard.intern.tabs.loading')} />
  }

  if (error) {
    return (
      <InternTabError
        title={t('dashboard.intern.tabs.errorTitle')}
        message={toErrorMessage(error, t('dashboard.intern.tabs.errorMessage'))}
        retryLabel={t('dashboard.intern.error.retry')}
        onRetry={refetch}
      />
    )
  }

  if (meetings.length === 0) {
    return (
      <InternTabEmpty
        title={t('dashboard.intern.meetings.emptyTitle')}
        message={t('dashboard.intern.meetings.emptyMessage')}
      />
    )
  }

  return (
    <section className="intern-panel">
      <div className="intern-section-header">
        <div>
          <p className="intern-eyebrow">{t('dashboard.intern.tabs.meetings')}</p>
          <h2>{t('dashboard.intern.meetings.upcoming')}</h2>
        </div>
      </div>

      <ol className="intern-timeline-list">
        {meetings.map((meeting) => (
          <li key={meeting.id}>
            <time>{formatDate(meeting.date)}</time>
            <strong>{meeting.supervisorName || t('dashboard.intern.meetings.supervisor')}</strong>
            {meeting.notes && <p>{meeting.notes}</p>}
          </li>
        ))}
      </ol>
    </section>
  )
}

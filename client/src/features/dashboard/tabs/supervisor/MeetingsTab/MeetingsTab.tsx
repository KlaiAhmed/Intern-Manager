import { addMonths, format, subMonths } from 'date-fns'
import { useMemo, useState } from 'react'

import { DashboardButton } from '@/features/dashboard/components/DashboardButton'
import { ErrorState } from '@/features/dashboard/components/ErrorState'
import { Calendar } from '@/features/dashboard/components/IconComponents'
import { Panel } from '@/features/dashboard/components/Panel'
import { Skeleton } from '@/features/dashboard/components/Skeleton'
import { useI18n } from '@/locales/I18nContext'

import { useMeetingsData } from './hooks/useMeetingsData'

function formatMeetingDate(value: string, fallback: string): string {
  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return fallback
  }

  return format(parsedDate, 'PPp')
}

export function MeetingsTab() {
  const { t } = useI18n()
  const [viewDate, setViewDate] = useState(() => new Date())
  const viewYear = viewDate.getFullYear()
  const viewMonth = viewDate.getMonth()
  const {
    meetings,
    isLoading,
    error,
    refresh,
  } = useMeetingsData(viewYear, viewMonth)

  const sortedMeetings = useMemo(
    () => [...meetings].sort((left, right) => left.date.localeCompare(right.date)),
    [meetings],
  )

  if (isLoading) {
    return (
      <Panel title={t('dashboard.supervisor.tabs.meetings')}>
        <div className="supervisor-meetings-skeleton">
          <Skeleton height="44px" />
          <Skeleton height="92px" />
          <Skeleton height="92px" />
        </div>
      </Panel>
    )
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => { void refresh() }} />
  }

  return (
    <Panel
      title={t('dashboard.supervisor.tabs.meetings')}
      actions={(
        <div className="supervisor-meetings-actions">
          <DashboardButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setViewDate((currentDate) => subMonths(currentDate, 1))}
          >
            {t('dashboard.table.previous')}
          </DashboardButton>
          <span className="supervisor-meetings-month">{format(viewDate, 'MMMM yyyy')}</span>
          <DashboardButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setViewDate((currentDate) => addMonths(currentDate, 1))}
          >
            {t('dashboard.table.next')}
          </DashboardButton>
        </div>
      )}
    >
      {sortedMeetings.length === 0 ? (
        <div className="dash-empty">
          <h3 className="dash-empty-title">{t('dashboard.supervisor.empty.noMeetings')}</h3>
          <p className="dash-empty-description">{t('dashboard.noData')}</p>
        </div>
      ) : (
        <ul className="supervisor-meetings-list">
          {sortedMeetings.map((meeting) => (
            <li key={meeting.id} className="supervisor-meetings-item">
              <span className="supervisor-meetings-item__icon" aria-hidden="true">
                <Calendar size={18} />
              </span>
              <div className="supervisor-meetings-item__body">
                <h3>{meeting.parsedTitle || meeting.internName || t('dashboard.supervisor.meetings')}</h3>
                <time dateTime={meeting.date}>{formatMeetingDate(meeting.date, t('dashboard.noData'))}</time>
                {meeting.parsedBody && <p>{meeting.parsedBody}</p>}
                {meeting.parsedMeetingUrl && (
                  <a href={meeting.parsedMeetingUrl} target="_blank" rel="noreferrer">
                    {meeting.parsedMeetingUrl}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

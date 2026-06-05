import { addMonths, format, subMonths } from 'date-fns'
import { useCallback, useMemo, useState } from 'react'

import { DashboardButton } from '@/features/dashboard/components/DashboardButton'
import { ErrorState } from '@/features/dashboard/components/ErrorState'
import { Calendar, Plus } from '@/features/dashboard/components/IconComponents'
import { Panel } from '@/features/dashboard/components/Panel'
import { Skeleton } from '@/features/dashboard/components/Skeleton'
import { Toast } from '@/features/dashboard/components/Toast/Toast'
import { useToast } from '@/features/dashboard/components/Toast/useToast'
import {
  SupervisorMeetingForm,
  emptyMeetingFormValues,
  type MeetingFormValues,
} from '@/features/dashboard/components/supervisor/SupervisorMeetingForm'
import type {
  CreateMeetingRequest,
  SupervisorIntern,
} from '@/features/dashboard/types/supervisorDashboard'
import { useI18n } from '@/locales/I18nContext'

import { useMeetingsData } from './hooks/useMeetingsData'

function formatMeetingDate(value: string, fallback: string): string {
  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return fallback
  }

  return format(parsedDate, 'PPp')
}

function toUtcIsoString(localDateTime: string): string | null {
  if (!localDateTime) {
    return null
  }

  const parsed = new Date(localDateTime)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString()
}

function isValidUrl(value: string): boolean {
  if (!value) {
    return true
  }
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function toInternOptions(interns: SupervisorIntern[]) {
  return interns
    .filter((intern) => intern.id && intern.fullName)
    .map((intern) => ({ id: intern.id, fullName: intern.fullName }))
}

export function MeetingsTab() {
  const { t } = useI18n()
  const [viewDate, setViewDate] = useState(() => new Date())
  const viewYear = viewDate.getFullYear()
  const viewMonth = viewDate.getMonth()
  const {
    meetings,
    interns,
    isLoading,
    error,
    refresh,
    createMeeting,
  } = useMeetingsData(viewYear, viewMonth)
  const { toasts, showToast, dismissToast } = useToast()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [meetingForm, setMeetingForm] = useState<MeetingFormValues>(emptyMeetingFormValues)
  const [meetingFormError, setMeetingFormError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const internOptions = useMemo(() => toInternOptions(interns), [interns])

  const sortedMeetings = useMemo(
    () => [...meetings].sort((left, right) => left.date.localeCompare(right.date)),
    [meetings],
  )

  const resetForm = useCallback(() => {
    setMeetingForm(emptyMeetingFormValues)
    setMeetingFormError(null)
    setSubmitError(null)
  }, [])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setIsCreateOpen(nextOpen)
      if (!nextOpen) {
        resetForm()
      }
    },
    [resetForm],
  )

  const handleFieldChange = useCallback(
    (field: keyof MeetingFormValues, value: string) => {
      setMeetingForm((previous) => ({ ...previous, [field]: value }))
      if (meetingFormError) {
        setMeetingFormError(null)
      }
      if (submitError) {
        setSubmitError(null)
      }
    },
    [meetingFormError, submitError],
  )

  const handleSubmit = useCallback(async () => {
    if (!meetingForm.internId) {
      setMeetingFormError(t('dashboard.supervisor.meetings.validation.internRequired'))
      return
    }

    if (!meetingForm.date) {
      setMeetingFormError(t('dashboard.supervisor.meetings.validation.dateRequired'))
      return
    }

    const utcDate = toUtcIsoString(meetingForm.date)
    if (!utcDate) {
      setMeetingFormError(t('dashboard.supervisor.meetings.validation.dateRequired'))
      return
    }

    const scheduled = new Date(utcDate)
    if (scheduled.getTime() <= Date.now()) {
      setMeetingFormError(t('dashboard.supervisor.meetings.validation.dateRequired'))
      return
    }

    const trimmedTitle = meetingForm.title.trim()
    const trimmedUrl = meetingForm.meetingUrl.trim()
    const trimmedNote = meetingForm.note.trim()

    if (trimmedTitle.length > 200) {
      setMeetingFormError(t('dashboard.supervisor.error.validation'))
      return
    }

    if (trimmedUrl.length > 500 || !isValidUrl(trimmedUrl)) {
      setMeetingFormError(t('dashboard.supervisor.meetings.validation.urlInvalid'))
      return
    }

    if (trimmedNote.length > 3000) {
      setMeetingFormError(t('dashboard.supervisor.error.validation'))
      return
    }

    const request: CreateMeetingRequest = {
      InternId: meetingForm.internId,
      Date: utcDate,
      ...(trimmedTitle ? { Title: trimmedTitle } : {}),
      ...(trimmedUrl ? { MeetingUrl: trimmedUrl } : {}),
      ...(trimmedNote ? { Notes: trimmedNote } : {}),
    }

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await createMeeting(request)
      showToast(t('dashboard.supervisor.meetings.toast.createSuccess'), 'success')
      setIsCreateOpen(false)
      resetForm()
    } catch (requestError) {
      const message =
        requestError instanceof Error && requestError.message.trim()
          ? requestError.message
          : t('dashboard.supervisor.meetings.error.create')
      setSubmitError(message)
    } finally {
      setIsSubmitting(false)
    }
  }, [createMeeting, meetingForm, resetForm, showToast, t])

  const canCreateMeetings = internOptions.length > 0

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
    <>
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
            <DashboardButton
              type="button"
              variant="primary"
              size="sm"
              onClick={() => handleOpenChange(true)}
              disabled={!canCreateMeetings}
              title={canCreateMeetings
                ? t('dashboard.supervisor.meetings.create')
                : t('dashboard.supervisor.meetings.noInterns')}
            >
              <Plus />
              {t('dashboard.supervisor.meetings.create')}
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
            {sortedMeetings.map((meeting) => {
              // Prefer first-class title/url columns; fall back to the legacy parsed
              // notes encoding for rows that pre-date the schema change.
              const meetingTitle = meeting.title || meeting.parsedTitle || meeting.internName || t('dashboard.supervisor.meetings')
              const meetingUrl = meeting.meetingUrl || meeting.parsedMeetingUrl
              const meetingBody = meeting.title || meeting.meetingUrl ? meeting.notes : meeting.parsedBody
              return (
                <li key={meeting.id} className="supervisor-meetings-item">
                  <span className="supervisor-meetings-item__icon" aria-hidden="true">
                    <Calendar size={18} />
                  </span>
                  <div className="supervisor-meetings-item__body">
                    <h3>{meetingTitle}</h3>
                    <time dateTime={meeting.date}>{formatMeetingDate(meeting.date, t('dashboard.noData'))}</time>
                    {meetingBody && <p>{meetingBody}</p>}
                    {meetingUrl && (
                      <a href={meetingUrl} target="_blank" rel="noreferrer">
                        {meetingUrl}
                      </a>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <SupervisorMeetingForm
        internOptions={internOptions}
        meetingForm={meetingForm}
        meetingFormError={meetingFormError}
        submitError={submitError}
        isSubmitting={isSubmitting}
        isOpen={isCreateOpen}
        onOpenChange={handleOpenChange}
        onFieldChange={handleFieldChange}
        onSubmit={handleSubmit}
      />

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}

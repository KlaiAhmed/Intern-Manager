import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { useDashboardApi } from '../useDashboardApi'
import type { PagedResponse, SupervisorMeetingForm, SupervisorMeetingItem } from '../../types/supervisorDashboard'
import { toErrorMessage, toStringValue } from './utils'

interface MeetingApiItem {
  id?: unknown
  internId?: unknown
  internName?: unknown
  date?: unknown
  notes?: unknown
}

interface MeetingCreationApiResponse {
  id?: unknown
  date?: unknown
}

function sortByDateAscending(items: SupervisorMeetingItem[]): SupervisorMeetingItem[] {
  const sortable = [...items]
  sortable.sort((left, right) => {
    const leftTimestamp = Date.parse(left.date)
    const rightTimestamp = Date.parse(right.date)

    if (!Number.isFinite(leftTimestamp) && !Number.isFinite(rightTimestamp)) {
      return 0
    }

    if (!Number.isFinite(leftTimestamp)) {
      return 1
    }

    if (!Number.isFinite(rightTimestamp)) {
      return -1
    }

    return leftTimestamp - rightTimestamp
  })

  return sortable
}

export function useMeetings() {
  const { t } = useI18n()
  const { get, post } = useDashboardApi()

  const [meetings, setMeetings] = useState<SupervisorMeetingItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await get<PagedResponse<MeetingApiItem>>('/api/meetings?upcoming=true&supervisorId=me&page=1&limit=100')
      const mappedMeetings = sortByDateAscending(
        (response.data ?? [])
          .map((item) => ({
            id: toStringValue(item.id),
            internId: toStringValue(item.internId),
            internName: toStringValue(item.internName),
            date: toStringValue(item.date),
            notes: toStringValue(item.notes),
          }))
          .filter((item) => item.id.length > 0)
      )
      setMeetings(mappedMeetings)
    } catch (requestError) {
      setError(toErrorMessage(requestError, t('dashboard.error.load')))
    } finally {
      setIsLoading(false)
    }
  }, [get, t])

  const scheduleMeeting = useCallback(
    async (form: SupervisorMeetingForm): Promise<MeetingCreationApiResponse> => {
      const internId = form.internId.trim()
      if (!internId) {
        const message = t('dashboard.form.required')
        setSubmitError(message)
        throw new Error(message)
      }

      const normalizedDate = form.date.trim()
      if (!normalizedDate) {
        const message = t('dashboard.form.required')
        setSubmitError(message)
        throw new Error(message)
      }

      const parsedDate = new Date(normalizedDate)
      if (Number.isNaN(parsedDate.getTime())) {
        const message = t('dashboard.error.load')
        setSubmitError(message)
        throw new Error(message)
      }

      setIsSubmitting(true)
      setSubmitError(null)

      try {
        const response = await post<MeetingCreationApiResponse>('/api/meetings', {
          internId,
          date: parsedDate.toISOString(),
          notes: form.note.trim(),
        })

        await refresh()
        return response
      } catch (requestError) {
        const message = toErrorMessage(requestError, t('dashboard.error.load'))
        setSubmitError(message)
        throw new Error(message)
      } finally {
        setIsSubmitting(false)
      }
    },
    [post, refresh, t]
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    meetings,
    isLoading,
    error,
    isSubmitting,
    submitError,
    refresh,
    scheduleMeeting,
  }
}

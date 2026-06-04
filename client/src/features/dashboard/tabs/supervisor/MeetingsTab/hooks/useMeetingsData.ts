// NOTE: Gap 3 workaround — meeting title and video URL are encoded in the Notes field
// using TITLE:/URL: prefixes. See parseMeetingNotes() and buildMeetingNotes() in
// supervisorUtils.ts. Reversible when Meeting entity gains Title and MeetingUrl fields.
import { useCallback, useEffect, useState } from 'react'
import { endOfMonth, format, startOfMonth } from 'date-fns'

import { useI18n } from '../../../../../../locales/I18nContext'
import { useDashboardApi } from '../../../../hooks/useDashboardApi'
import { parseMeetingNotes } from '../../../../shared/utils/supervisorUtils'
import type {
  CreateMeetingRequest,
  SupervisorMeeting,
  UpdateMeetingRequest,
} from '../../../../types/supervisorDashboard'
import { toErrorMessage, toStringValue } from '../../../../hooks/supervisor/utils'

interface MeetingApiItem {
  id?: unknown
  supervisorId?: unknown
  internId?: unknown
  internName?: unknown
  date?: unknown
  notes?: unknown
  createdAt?: unknown
}

function readListItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload
  }
  if (payload && typeof payload === 'object') {
    const data = (payload as { data?: unknown }).data
    if (Array.isArray(data)) {
      return data
    }
  }
  return []
}

function mapMeeting(item: unknown): SupervisorMeeting | null {
  if (!item || typeof item !== 'object') {
    return null
  }
  const raw = item as MeetingApiItem
  const id = toStringValue(raw.id)
  if (!id) {
    return null
  }
  const notes = toStringValue(raw.notes)
  const parsed = parseMeetingNotes(notes)
  return {
    id,
    supervisorId: toStringValue(raw.supervisorId),
    internId: toStringValue(raw.internId),
    internName: toStringValue(raw.internName) || undefined,
    date: toStringValue(raw.date),
    notes,
    parsedTitle: parsed.title,
    parsedMeetingUrl: parsed.meetingUrl,
    parsedBody: parsed.body,
    createdAt: raw.createdAt === undefined ? undefined : toStringValue(raw.createdAt),
  }
}

function extractMeetings(payload: unknown): SupervisorMeeting[] {
  return readListItems(payload)
    .map((item) => mapMeeting(item))
    .filter((item): item is SupervisorMeeting => item !== null)
}

export function useMeetingsData(viewYear: number, viewMonth: number) {
  const { t } = useI18n()
  const { get, post, put, del } = useDashboardApi()

  const [meetings, setMeetings] = useState<SupervisorMeeting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const monthStart = format(startOfMonth(new Date(viewYear, viewMonth)), 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(new Date(viewYear, viewMonth)), 'yyyy-MM-dd')

      const response = await get<unknown>(`/api/meetings?from=${monthStart}&to=${monthEnd}`)
      setMeetings(extractMeetings(response))
    } catch (requestError) {
      setError(toErrorMessage(requestError, t('dashboard.error.load')))
    } finally {
      setIsLoading(false)
    }
  }, [get, t, viewMonth, viewYear])

  const createMeeting = useCallback(
    async (req: CreateMeetingRequest): Promise<void> => {
      await post<unknown>('/api/meetings', req)
      await refresh()
    },
    [post, refresh],
  )

  const updateMeeting = useCallback(
    async (id: string, req: UpdateMeetingRequest): Promise<void> => {
      await put<unknown>(`/api/meetings/${id}`, req)
      await refresh()
    },
    [put, refresh],
  )

  const deleteMeeting = useCallback(
    async (id: string): Promise<void> => {
      await del(`/api/meetings/${id}`)
      await refresh()
    },
    [del, refresh],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    meetings,
    isLoading,
    error,
    refresh,
    createMeeting,
    updateMeeting,
    deleteMeeting,
  }
}

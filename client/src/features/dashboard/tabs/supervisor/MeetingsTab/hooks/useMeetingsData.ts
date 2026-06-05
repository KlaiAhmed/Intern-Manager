import { useCallback, useEffect, useState } from 'react'
import { endOfMonth, format, startOfMonth } from 'date-fns'

import { useI18n } from '../../../../../../locales/I18nContext'
import { useDashboardApi } from '../../../../hooks/useDashboardApi'
import { parseMeetingNotes } from '../../../../shared/utils/supervisorUtils'
import type {
  CreateMeetingRequest,
  SupervisorIntern,
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
  title?: unknown
  meetingUrl?: unknown
  notes?: unknown
  createdAt?: unknown
}

interface SupervisorInternRow {
  id?: unknown
  name?: unknown
  fullName?: unknown
  firstName?: unknown
  lastName?: unknown
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
  // Prefer the first-class columns; fall back to the legacy `TITLE:`/`URL:`
  // notes encoding for records that pre-date the schema change.
  const titleColumn = raw.title === null || raw.title === undefined ? null : toStringValue(raw.title) || null
  const meetingUrlColumn =
    raw.meetingUrl === null || raw.meetingUrl === undefined ? null : toStringValue(raw.meetingUrl) || null
  const legacy = parseMeetingNotes(notes)

  return {
    id,
    supervisorId: toStringValue(raw.supervisorId),
    internId: toStringValue(raw.internId),
    internName: toStringValue(raw.internName) || undefined,
    date: toStringValue(raw.date),
    title: titleColumn,
    meetingUrl: meetingUrlColumn,
    notes,
    // Backwards-compatible parsed fields: prefer the structured columns when
    // present and only fall back to the parsed notes encoding for legacy rows.
    parsedTitle: titleColumn ?? (legacy.title || undefined),
    parsedMeetingUrl: meetingUrlColumn ?? legacy.meetingUrl,
    parsedBody: titleColumn || meetingUrlColumn ? notes : legacy.body,
    createdAt: raw.createdAt === undefined ? undefined : toStringValue(raw.createdAt),
  }
}

function mapSupervisorIntern(item: unknown): SupervisorIntern | null {
  if (!item || typeof item !== 'object') {
    return null
  }
  const raw = item as SupervisorInternRow
  const id = toStringValue(raw.id)
  if (!id) {
    return null
  }
  const firstName = toStringValue(raw.firstName)
  const lastName = toStringValue(raw.lastName)
  const composedName = `${firstName} ${lastName}`.trim()
  const fullName = toStringValue(raw.fullName) || toStringValue(raw.name) || composedName
  return {
    id,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    fullName,
  }
}

/**
 * Calendar-month meeting data and CRUD for the supervisor Meetings tab.
 *
 * Wiring map:
 * - List meetings   → `GET /api/meetings?from={monthStart}&to={monthEnd}` →
 *   paged `{ data, total, page, limit }` of meeting rows that include the
 *   first-class `title` and `meetingUrl` columns. The hook reads `.data`
 *   automatically; the previous code only handled flat arrays.
 * - Intern roster   → `GET /api/supervisor/me/interns` (paged). Fetched in
 *   parallel with the meetings list so the create-meeting form has intern
 *   options without a second round-trip.
 * - Create meeting  → `POST /api/meetings` with `{ InternId, Date, Title?,
 *   MeetingUrl?, Notes }`. The backend reads `SupervisorId` from the JWT, so
 *   it is no longer included in the payload (sending it caused validation
 *   noise on the server).
 * - Update meeting  → `PATCH /api/meetings/{id}` (not PUT) with a partial
 *   `{ Date?, Title?, MeetingUrl?, Notes? }` body.
 * - Delete meeting  → `DELETE /api/meetings/{id}`.
 *
 * The legacy `TITLE:`/`URL:` notes-encoding workaround is no longer used on
 * write paths; reads still parse it for back-compat with rows that pre-date
 * the schema change.
 */
export function useMeetingsData(viewYear: number, viewMonth: number) {
  const { t } = useI18n()
  const { get, post, patch, del } = useDashboardApi()

  const [meetings, setMeetings] = useState<SupervisorMeeting[]>([])
  const [interns, setInterns] = useState<SupervisorIntern[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const monthStart = format(startOfMonth(new Date(viewYear, viewMonth)), 'yyyy-MM-dd')
      const monthEnd = format(endOfMonth(new Date(viewYear, viewMonth)), 'yyyy-MM-dd')

      const [meetingsResponse, internsResponse] = await Promise.all([
        get<unknown>(`/api/meetings?from=${monthStart}&to=${monthEnd}`),
        get<unknown>('/api/supervisor/me/interns'),
      ])

      const parsedMeetings = readListItems(meetingsResponse)
        .map((item) => mapMeeting(item))
        .filter((item): item is SupervisorMeeting => item !== null)
      const parsedInterns = readListItems(internsResponse)
        .map((item) => mapSupervisorIntern(item))
        .filter((item): item is SupervisorIntern => item !== null)

      setMeetings(parsedMeetings)
      setInterns(parsedInterns)
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
      await patch<unknown>(`/api/meetings/${id}`, req)
      await refresh()
    },
    [patch, refresh],
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
    interns,
    isLoading,
    error,
    refresh,
    createMeeting,
    updateMeeting,
    deleteMeeting,
  }
}

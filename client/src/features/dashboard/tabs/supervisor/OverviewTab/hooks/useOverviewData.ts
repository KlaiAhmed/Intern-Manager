import { useCallback, useEffect, useState } from 'react'
import { addDays, format } from 'date-fns'

import { useI18n } from '../../../../../../locales/I18nContext'
import { useDashboardApi } from '../../../../hooks/useDashboardApi'
import type {
  DeliverableStatus,
  InternWithProgress,
  MissionStatus,
  SupervisorDeliverable,
  SupervisorIntern,
  SupervisorMission,
  SupervisorWorkload,
} from '../../../../types/supervisorDashboard'
import { clampProgress, toErrorMessage, toNumber, toStringValue } from '../../../../hooks/supervisor/utils'

const KNOWN_MISSION_STATUSES: readonly MissionStatus[] = [
  'template',
  'active',
  'paused',
  'completed',
  'cancelled',
  'archived',
]

const KNOWN_DELIVERABLE_STATUSES: readonly DeliverableStatus[] = [
  'draft',
  'in_progress',
  'awaiting_review',
  'approved',
  'changes_requested',
  'cancelled',
]

interface CountResponse {
  count?: unknown
}

interface WorkloadResponse {
  currentInternCount?: unknown
  maxCapacity?: unknown
  utilizationPercent?: unknown
  pfeCount?: unknown
  summerCount?: unknown
  otherCount?: unknown
}

interface SupervisorInternRow {
  id?: unknown
  name?: unknown
  fullName?: unknown
  firstName?: unknown
  lastName?: unknown
  email?: unknown
  missionTitle?: unknown
  startDate?: unknown
  endDate?: unknown
  status?: unknown
  verificationStatus?: unknown
  progress?: unknown
  lastJournalDate?: unknown
  isOverdue?: unknown
}

interface MissionApiResponse {
  id?: unknown
  title?: unknown
  description?: unknown
  status?: unknown
  internId?: unknown
  internIds?: unknown
  internName?: unknown
  internNames?: unknown
  supervisorId?: unknown
  coSupervisorId?: unknown
  coSupervisorCanReview?: unknown
  coSupervisorCanEval?: unknown
  tools?: unknown
  level?: unknown
  skills?: unknown
  rawProgress?: unknown
  startDate?: unknown
  endDate?: unknown
  createdAt?: unknown
  updatedAt?: unknown
  rowVersion?: unknown
}

interface DeliverableApiItem {
  id?: unknown
  missionId?: unknown
  supervisorId?: unknown
  internId?: unknown
  internName?: unknown
  title?: unknown
  description?: unknown
  status?: unknown
  version?: unknown
  fileUrl?: unknown
  rowVersion?: unknown
  rawProgress?: unknown
  weight?: unknown
  dueDate?: unknown
  submittedDate?: unknown
  supervisorComment?: unknown
  createdAt?: unknown
  tasks?: unknown
}

interface InternProgressEntry {
  internId?: unknown
  internFullName?: unknown
  taskCount?: unknown
  taskDoneCount?: unknown
  deliverableCount?: unknown
  deliverableApprovedCount?: unknown
  progressPercent?: unknown
}

interface MissionProgressResponse {
  missionId?: unknown
  totalInterns?: unknown
  taskCount?: unknown
  taskDoneCount?: unknown
  deliverableCount?: unknown
  deliverableApprovedCount?: unknown
  progressPercent?: unknown
  perInternProgress?: unknown
}

function toMissionStatus(value: unknown): MissionStatus {
  const normalized = toStringValue(value, 'template').trim().toLowerCase()
  const candidate = normalized === 'draft' ? 'template' : normalized
  if ((KNOWN_MISSION_STATUSES as readonly string[]).includes(candidate)) {
    return candidate as MissionStatus
  }
  return 'template'
}

function toDeliverableStatus(value: unknown): DeliverableStatus {
  const candidate = toStringValue(value, 'draft')
  if ((KNOWN_DELIVERABLE_STATUSES as readonly string[]).includes(candidate)) {
    return candidate as DeliverableStatus
  }
  return 'draft'
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

function readCount(payload: unknown): number {
  if (!payload || typeof payload !== 'object') {
    return 0
  }
  const raw = (payload as CountResponse).count
  return Math.max(0, Math.round(toNumber(raw, 0)))
}

function readList<T>(payload: unknown, mapper: (item: unknown) => T | null): T[] {
  return readListItems(payload)
    .map((item) => mapper(item))
    .filter((item): item is T => item !== null)
}

function mapWorkload(payload: unknown): SupervisorWorkload | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const raw = payload as WorkloadResponse
  const maxCapacityRaw = toNumber(raw.maxCapacity, Number.NaN)
  const utilizationRaw = toNumber(raw.utilizationPercent, Number.NaN)
  return {
    currentInternCount: Math.max(0, Math.round(toNumber(raw.currentInternCount))),
    maxCapacity: Number.isFinite(maxCapacityRaw) ? Math.max(0, Math.round(maxCapacityRaw)) : null,
    utilizationPercent: Number.isFinite(utilizationRaw)
      ? Math.max(0, Math.round(utilizationRaw))
      : undefined,
    pfeCount: Math.max(0, Math.round(toNumber(raw.pfeCount))),
    summerCount: Math.max(0, Math.round(toNumber(raw.summerCount))),
    otherCount: Math.max(0, Math.round(toNumber(raw.otherCount))),
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
  // `GET /api/supervisor/me/interns` returns a single `name` field; legacy callers
  // returned firstName/lastName/fullName. Prefer `fullName` when supplied, then `name`,
  // then a composed first/last fallback.
  const composedName = `${firstName} ${lastName}`.trim()
  const fullName = toStringValue(raw.fullName) || toStringValue(raw.name) || composedName
  const lastJournalRaw = toStringValue(raw.lastJournalDate)
  const progressRaw = toNumber(raw.progress, Number.NaN)
  return {
    id,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
    fullName,
    email: toStringValue(raw.email) || undefined,
    missionTitle: toStringValue(raw.missionTitle) || undefined,
    startDate: toStringValue(raw.startDate) || null,
    endDate: toStringValue(raw.endDate) || null,
    status: toStringValue(raw.status) || undefined,
    verificationStatus: toStringValue(raw.verificationStatus) || undefined,
    progressPercent: Number.isFinite(progressRaw) ? clampProgress(progressRaw) : undefined,
    lastJournalDate: lastJournalRaw || null,
    isOverdue: raw.isOverdue === true,
  }
}

function mapMission(payload: unknown): SupervisorMission | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }
  const raw = payload as MissionApiResponse
  const id = toStringValue(raw.id)
  if (!id) {
    return null
  }
  const skills = Array.isArray(raw.skills)
    ? (raw.skills as unknown[])
        .map((entry) => toStringValue(entry))
        .filter((entry) => entry.length > 0)
    : []
  const internIds = Array.isArray(raw.internIds)
    ? (raw.internIds as unknown[])
        .map((entry) => toStringValue(entry))
        .filter((entry) => entry.length > 0)
    : undefined
  const internNames = Array.isArray(raw.internNames)
    ? (raw.internNames as unknown[])
        .map((entry) => toStringValue(entry))
        .filter((entry) => entry.length > 0)
    : undefined
  const rowVersionRaw = toNumber(raw.rowVersion, Number.NaN)
  return {
    id,
    title: toStringValue(raw.title),
    description: toStringValue(raw.description),
    status: toMissionStatus(raw.status),
    internId: toStringValue(raw.internId),
    internIds,
    internNames,
    supervisorId: toStringValue(raw.supervisorId),
    coSupervisorId:
      raw.coSupervisorId === null || raw.coSupervisorId === undefined
        ? null
        : toStringValue(raw.coSupervisorId) || null,
    coSupervisorCanReview: raw.coSupervisorCanReview === true,
    coSupervisorCanEval: raw.coSupervisorCanEval === true,
    tools: toStringValue(raw.tools),
    level: toStringValue(raw.level),
    skills,
    rawProgress: Math.max(0, Math.min(100, toNumber(raw.rawProgress, 0))),
    startDate:
      raw.startDate === null || raw.startDate === undefined ? null : toStringValue(raw.startDate) || null,
    endDate: raw.endDate === null || raw.endDate === undefined ? null : toStringValue(raw.endDate) || null,
    createdAt: toStringValue(raw.createdAt),
    updatedAt: toStringValue(raw.updatedAt),
    rowVersion: Number.isFinite(rowVersionRaw) ? rowVersionRaw : undefined,
  }
}

function mapDeliverable(item: unknown): SupervisorDeliverable | null {
  if (!item || typeof item !== 'object') {
    return null
  }
  const raw = item as DeliverableApiItem
  const id = toStringValue(raw.id)
  if (!id) {
    return null
  }
  const rowVersionRaw = toNumber(raw.rowVersion, Number.NaN)

  return {
    id,
    missionId: toStringValue(raw.missionId),
    supervisorId: toStringValue(raw.supervisorId),
    internId:
      raw.internId === null || raw.internId === undefined ? null : toStringValue(raw.internId) || null,
    internName: toStringValue(raw.internName) || undefined,
    title: toStringValue(raw.title),
    description: toStringValue(raw.description) || undefined,
    status: toDeliverableStatus(raw.status),
    version: Math.max(0, Math.round(toNumber(raw.version))),
    fileUrl: toStringValue(raw.fileUrl),
    rowVersion: Number.isFinite(rowVersionRaw) ? rowVersionRaw : undefined,
    rawProgress: clampProgress(toNumber(raw.rawProgress)),
    weight: Math.max(0, toNumber(raw.weight)),
    dueDate:
      raw.dueDate === null || raw.dueDate === undefined ? null : toStringValue(raw.dueDate) || null,
    submittedDate:
      raw.submittedDate === null || raw.submittedDate === undefined
        ? null
        : toStringValue(raw.submittedDate) || null,
    supervisorComment:
      raw.supervisorComment === null || raw.supervisorComment === undefined
        ? null
        : toStringValue(raw.supervisorComment) || null,
    createdAt: toStringValue(raw.createdAt) || undefined,
  }
}

function mapProgressEntries(payload: unknown): Map<string, InternProgressEntry> {
  if (!payload || typeof payload !== 'object') {
    return new Map()
  }
  const raw = (payload as MissionProgressResponse).perInternProgress
  if (!Array.isArray(raw)) {
    return new Map()
  }
  const entries = new Map<string, InternProgressEntry>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const entry = item as InternProgressEntry
    const internId = toStringValue(entry.internId)
    if (internId) {
      entries.set(internId, entry)
    }
  }
  return entries
}

function buildInternProgressRows(
  interns: SupervisorIntern[],
  progressByInternId: Map<string, InternProgressEntry>,
): InternWithProgress[] {
  return interns.map((intern) => {
    const entry = progressByInternId.get(intern.id)
    const taskCount = Math.max(0, Math.round(toNumber(entry?.taskCount)))
    const taskDoneCount = Math.max(0, Math.round(toNumber(entry?.taskDoneCount)))
    const deliverableCount = Math.max(0, Math.round(toNumber(entry?.deliverableCount)))
    const deliverableApprovedCount = Math.max(0, Math.round(toNumber(entry?.deliverableApprovedCount)))
    const progressRaw = toNumber(entry?.progressPercent, Number.NaN)
    const progressPercent = Number.isFinite(progressRaw)
      ? clampProgress(progressRaw)
      : intern.progressPercent ?? 0

    return {
      ...intern,
      fullName: toStringValue(entry?.internFullName) || intern.fullName,
      taskCount,
      taskDoneCount,
      deliverableCount,
      deliverableApprovedCount,
      progressPercent,
    }
  })
}

/**
 * Aggregates all data for the supervisor Overview tab.
 *
 * Wiring map:
 * - Workload                 → `GET /api/stats/supervisor/me/workload`
 * - Pending review count     → `GET /api/stats/supervisor/me/deliverables/pending` → `{ count }`
 * - Upcoming meeting count   → `GET /api/meetings?from={today}&to={today+7d}&count=true` → `{ count }`
 * - Intern roster            → `GET /api/supervisor/me/interns` (paged)
 * - Mission detail           → `GET /api/missions/{missionId}`
 * - Deliverables for timeline→ `GET /api/deliverables/mission/{missionId}` (flat list)
 * - Per-intern progress      → `GET /api/supervisor/missions/{missionId}/progress`
 *   Replaces the prior client-side fan-out over `/api/tasks/by-intern/{id}` (which
 *   the backend has retired in favour of `/api/tasks/by-mission/{missionId}`).
 *
 * Any single failure short-circuits the tab into the error state, which matches
 * the implementation plan's "all-or-nothing summary surface" rule.
 */
export function useOverviewData(missionId: string) {
  const { t } = useI18n()
  const { get } = useDashboardApi()

  const [workload, setWorkload] = useState<SupervisorWorkload | null>(null)
  const [pendingReviewCount, setPendingReviewCount] = useState(0)
  const [upcomingMeetingCount, setUpcomingMeetingCount] = useState(0)
  const [interns, setInterns] = useState<InternWithProgress[]>([])
  const [mission, setMission] = useState<SupervisorMission | null>(null)
  const [deliverables, setDeliverables] = useState<SupervisorDeliverable[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!missionId) {
      setWorkload(null)
      setPendingReviewCount(0)
      setUpcomingMeetingCount(0)
      setInterns([])
      setMission(null)
      setDeliverables([])
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const today = new Date()
      const weekAhead = addDays(today, 7)
      const fromIso = format(today, 'yyyy-MM-dd')
      const toIso = format(weekAhead, 'yyyy-MM-dd')

      const [
        workloadResponse,
        pendingResponse,
        meetingsResponse,
        internsResponse,
        missionResponse,
        deliverablesResponse,
        progressResponse,
      ] = await Promise.all([
        get<WorkloadResponse>('/api/stats/supervisor/me/workload'),
        get<CountResponse>('/api/stats/supervisor/me/deliverables/pending'),
        get<CountResponse>(`/api/meetings?from=${fromIso}&to=${toIso}&count=true`),
        get<unknown>('/api/supervisor/me/interns'),
        get<MissionApiResponse>(`/api/missions/${missionId}`),
        get<unknown>(`/api/deliverables/mission/${missionId}`),
        get<MissionProgressResponse>(`/api/supervisor/missions/${missionId}/progress`),
      ])

      const mappedInterns = readList(internsResponse, mapSupervisorIntern)
      const mappedDeliverables = readList(deliverablesResponse, mapDeliverable)
      const progressEntries = mapProgressEntries(progressResponse)

      setWorkload(mapWorkload(workloadResponse))
      setPendingReviewCount(readCount(pendingResponse))
      setUpcomingMeetingCount(readCount(meetingsResponse))
      setInterns(buildInternProgressRows(mappedInterns, progressEntries))
      setMission(mapMission(missionResponse))
      setDeliverables(mappedDeliverables)
    } catch (requestError) {
      setError(toErrorMessage(requestError, t('dashboard.error.load')))
    } finally {
      setIsLoading(false)
    }
  }, [get, missionId, t])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    workload,
    pendingReviewCount,
    upcomingMeetingCount,
    interns,
    mission,
    deliverables,
    isLoading,
    error,
    refresh,
  }
}

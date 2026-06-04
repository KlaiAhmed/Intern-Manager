import { useCallback, useEffect, useState } from 'react'
import { addDays, format } from 'date-fns'

import { useI18n } from '../../../../../../locales/I18nContext'
import { useDashboardApi } from '../../../../hooks/useDashboardApi'
import type {
  DeliverableStatus,
  InternWithProgress,
  MissionHistoryEntry,
  MissionStatus,
  SupervisorDeliverable,
  SupervisorIntern,
  SupervisorMission,
  SupervisorTask,
  SupervisorWorkload,
  TaskStatus,
} from '../../../../types/supervisorDashboard'
import { clampProgress, toErrorMessage, toNumber, toStringValue } from '../../../../hooks/supervisor/utils'

const KNOWN_MISSION_STATUSES: readonly MissionStatus[] = [
  'draft',
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

const KNOWN_TASK_STATUSES: readonly TaskStatus[] = [
  'todo',
  'in_progress',
  'done',
  'reopened',
  'cancelled',
]

const ACTIVITY_FEED_LIMIT = 10

interface WorkloadResponse {
  currentInternCount?: unknown
  maxCapacity?: unknown
  utilizationPercent?: unknown
  pfeCount?: unknown
  summerCount?: unknown
  otherCount?: unknown
}

interface InternApiItem {
  id?: unknown
  firstName?: unknown
  lastName?: unknown
  fullName?: unknown
  email?: unknown
  missionId?: unknown
  missionTitle?: unknown
  startDate?: unknown
  endDate?: unknown
  status?: unknown
  verificationStatus?: unknown
}

interface MissionApiResponse {
  id?: unknown
  title?: unknown
  description?: unknown
  status?: unknown
  internId?: unknown
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

interface TaskApiItem {
  id?: unknown
  internId?: unknown
  deliverableId?: unknown
  title?: unknown
  description?: unknown
  dueDate?: unknown
  status?: unknown
  rowVersion?: unknown
  completedAt?: unknown
  createdAt?: unknown
}

interface HistoryApiItem {
  id?: unknown
  missionId?: unknown
  action?: unknown
  field?: unknown
  oldValue?: unknown
  newValue?: unknown
  changedByUserId?: unknown
  changedBy?: unknown
  changedAt?: unknown
}

function toMissionStatus(value: unknown): MissionStatus {
  const candidate = toStringValue(value, 'draft')
  if ((KNOWN_MISSION_STATUSES as readonly string[]).includes(candidate)) {
    return candidate as MissionStatus
  }
  return 'draft'
}

function toDeliverableStatus(value: unknown): DeliverableStatus {
  const candidate = toStringValue(value, 'draft')
  if ((KNOWN_DELIVERABLE_STATUSES as readonly string[]).includes(candidate)) {
    return candidate as DeliverableStatus
  }
  return 'draft'
}

function toTaskStatus(value: unknown): TaskStatus {
  const candidate = toStringValue(value, 'todo')
  if ((KNOWN_TASK_STATUSES as readonly string[]).includes(candidate)) {
    return candidate as TaskStatus
  }
  return 'todo'
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

function readListLength(payload: unknown): number {
  return readListItems(payload).length
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

function mapIntern(item: unknown): SupervisorIntern | null {
  if (!item || typeof item !== 'object') {
    return null
  }
  const raw = item as InternApiItem
  const id = toStringValue(raw.id)
  if (!id) {
    return null
  }
  const firstName = toStringValue(raw.firstName)
  const lastName = toStringValue(raw.lastName)
  const composedFullName = `${firstName} ${lastName}`.trim()
  return {
    id,
    firstName,
    lastName,
    fullName: toStringValue(raw.fullName) || composedFullName,
    email: toStringValue(raw.email),
    missionId: toStringValue(raw.missionId) || null,
    missionTitle: toStringValue(raw.missionTitle) || undefined,
    startDate: toStringValue(raw.startDate) || null,
    endDate: toStringValue(raw.endDate) || null,
    status: toStringValue(raw.status) || undefined,
    verificationStatus: toStringValue(raw.verificationStatus) || undefined,
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
  return {
    id,
    title: toStringValue(raw.title),
    description: toStringValue(raw.description),
    status: toMissionStatus(raw.status),
    internId: toStringValue(raw.internId),
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
    rowVersion: raw.rowVersion === undefined ? undefined : toStringValue(raw.rowVersion),
  }
}

function mapTask(item: unknown, fallbackInternId = ''): SupervisorTask | null {
  if (!item || typeof item !== 'object') {
    return null
  }
  const raw = item as TaskApiItem
  const id = toStringValue(raw.id)
  if (!id) {
    return null
  }
  return {
    id,
    internId: toStringValue(raw.internId) || fallbackInternId,
    deliverableId:
      raw.deliverableId === null || raw.deliverableId === undefined
        ? null
        : toStringValue(raw.deliverableId) || null,
    title: toStringValue(raw.title),
    description: toStringValue(raw.description) || undefined,
    dueDate: toStringValue(raw.dueDate) || undefined,
    status: toTaskStatus(raw.status),
    rowVersion: raw.rowVersion === undefined ? undefined : toStringValue(raw.rowVersion),
    completedAt:
      raw.completedAt === null || raw.completedAt === undefined ? null : toStringValue(raw.completedAt) || null,
    createdAt: toStringValue(raw.createdAt) || undefined,
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
  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks.map((task) => mapTask(task)).filter((task): task is SupervisorTask => task !== null)
    : undefined

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
    rowVersion: raw.rowVersion === undefined ? undefined : toStringValue(raw.rowVersion),
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
    tasks,
  }
}

function mapHistoryEntry(item: unknown): MissionHistoryEntry | null {
  if (!item || typeof item !== 'object') {
    return null
  }
  const raw = item as HistoryApiItem
  const id = toStringValue(raw.id)
  if (!id) {
    return null
  }
  return {
    id,
    missionId: toStringValue(raw.missionId),
    action: toStringValue(raw.action) || undefined,
    field: toStringValue(raw.field),
    oldValue: raw.oldValue === null || raw.oldValue === undefined ? null : toStringValue(raw.oldValue) || null,
    newValue: raw.newValue === null || raw.newValue === undefined ? null : toStringValue(raw.newValue) || null,
    changedByUserId:
      raw.changedByUserId === null || raw.changedByUserId === undefined
        ? null
        : toStringValue(raw.changedByUserId) || null,
    changedBy: toStringValue(raw.changedBy),
    changedAt: toStringValue(raw.changedAt),
  }
}

function buildInternProgressRows(
  interns: SupervisorIntern[],
  deliverables: SupervisorDeliverable[],
  tasksByInternId: Map<string, SupervisorTask[]>,
): InternWithProgress[] {
  return interns.map((intern) => {
    const tasks = tasksByInternId.get(intern.id) ?? []
    const internDeliverables = deliverables.filter((deliverable) => deliverable.internId === intern.id)
    const taskCount = tasks.length
    const taskDoneCount = tasks.filter((task) => task.status === 'done').length
    const deliverableCount = internDeliverables.length
    const deliverableApprovedCount = internDeliverables.filter((deliverable) => deliverable.status === 'approved').length
    const progressPercent =
      taskCount > 0
        ? clampProgress((taskDoneCount / taskCount) * 100)
        : deliverableCount > 0
          ? clampProgress((deliverableApprovedCount / deliverableCount) * 100)
          : 0

    return {
      ...intern,
      taskCount,
      taskDoneCount,
      deliverableCount,
      deliverableApprovedCount,
      progressPercent,
    }
  })
}

export function useOverviewData(missionId: string) {
  const { t } = useI18n()
  const { get } = useDashboardApi()

  const [workload, setWorkload] = useState<SupervisorWorkload | null>(null)
  const [pendingReviewCount, setPendingReviewCount] = useState(0)
  const [upcomingMeetingCount, setUpcomingMeetingCount] = useState(0)
  const [interns, setInterns] = useState<InternWithProgress[]>([])
  const [mission, setMission] = useState<SupervisorMission | null>(null)
  const [deliverables, setDeliverables] = useState<SupervisorDeliverable[]>([])
  const [activityFeed, setActivityFeed] = useState<MissionHistoryEntry[]>([])
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
      setActivityFeed([])
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
        queueResponse,
        meetingsResponse,
        internsResponse,
        missionResponse,
        deliverablesResponse,
        historyResponse,
      ] = await Promise.all([
        get<WorkloadResponse>('/api/supervisor/stats'),
        get<unknown>('/api/deliverables/queue?status=awaiting_review'),
        get<unknown>(`/api/meetings?from=${fromIso}&to=${toIso}`),
        get<unknown>('/api/supervisor/interns'),
        get<MissionApiResponse>(`/api/missions/${missionId}`),
        get<unknown>(`/api/deliverables/mission/${missionId}`),
        get<unknown>(`/api/missions/${missionId}/history`),
      ])

      const mappedInterns = readList(internsResponse, mapIntern)
      const mappedDeliverables = readList(deliverablesResponse, mapDeliverable)
      const taskResponses = await Promise.all(
        mappedInterns.map((intern) =>
          get<unknown>(`/api/tasks/by-intern/${intern.id}`)
            .then((payload) => readList(payload, (item) => mapTask(item, intern.id)))
            .catch(() => []),
        ),
      )
      const tasksByInternId = new Map<string, SupervisorTask[]>(
        mappedInterns.map((intern, index) => [intern.id, taskResponses[index] ?? []]),
      )

      setWorkload(mapWorkload(workloadResponse))
      setPendingReviewCount(readListLength(queueResponse))
      setUpcomingMeetingCount(readListLength(meetingsResponse))
      setInterns(buildInternProgressRows(mappedInterns, mappedDeliverables, tasksByInternId))
      setMission(mapMission(missionResponse))
      setDeliverables(mappedDeliverables)
      setActivityFeed(readList(historyResponse, mapHistoryEntry).slice(0, ACTIVITY_FEED_LIMIT))
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
    activityFeed,
    isLoading,
    error,
    refresh,
  }
}

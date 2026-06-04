import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '@/locales/I18nContext'
import { useDashboardApi } from '@/features/dashboard/hooks/useDashboardApi'
import type {
  CreateTaskRequest,
  SupervisorDeliverable,
  SupervisorIntern,
  SupervisorTask,
  TaskStatus,
  UpdateTaskRequest,
} from '@/features/dashboard/types/supervisorDashboard'
import { toErrorMessage, toNumber, toStringValue } from '@/features/dashboard/hooks/supervisor/utils'
import { isTaskOverdue } from '@/features/dashboard/shared/utils/supervisorUtils'

type EnrichedTask = SupervisorTask & { isOverdue: boolean }

const KNOWN_TASK_STATUSES: readonly TaskStatus[] = [
  'todo',
  'in_progress',
  'done',
  'reopened',
  'cancelled',
]

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

interface InternTaskRow {
  id?: unknown
  internId?: unknown
  deliverableId?: unknown
  title?: unknown
  description?: unknown
  status?: unknown
  rowVersion?: unknown
  dueDate?: unknown
  completedAt?: unknown
  createdAt?: unknown
}

/**
 * Step 1 wiring stub for mutations that the backend has not yet exposed.
 * The Tasks tab still surfaces buttons that map to these mutations; the hook
 * throws a deterministic error so the UI's existing toast catches it instead
 * of issuing a request to a route that returns 404.
 */
class NotImplementedOnBackendError extends Error {
  constructor(operation: string) {
    super(`${operation} is not yet supported by the API.`)
    this.name = 'NotImplementedOnBackendError'
  }
}

export { NotImplementedOnBackendError }

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
    progressPercent: Number.isFinite(progressRaw)
      ? Math.max(0, Math.min(100, Math.round(progressRaw)))
      : undefined,
    lastJournalDate: toStringValue(raw.lastJournalDate) || null,
    isOverdue: raw.isOverdue === true,
  }
}

function mapTask(item: unknown, deliverableTitleById: Map<string, string>): SupervisorTask | null {
  if (!item || typeof item !== 'object') {
    return null
  }
  const raw = item as InternTaskRow
  const id = toStringValue(raw.id)
  if (!id) {
    return null
  }
  const statusCandidate = toStringValue(raw.status, 'todo')
  const status: TaskStatus = (KNOWN_TASK_STATUSES as readonly string[]).includes(statusCandidate)
    ? (statusCandidate as TaskStatus)
    : 'todo'

  const deliverableIdValue =
    raw.deliverableId === null || raw.deliverableId === undefined
      ? null
      : toStringValue(raw.deliverableId) || null
  const rowVersionRaw = toNumber(raw.rowVersion, Number.NaN)

  return {
    id,
    internId: toStringValue(raw.internId),
    deliverableId: deliverableIdValue,
    title: toStringValue(raw.title),
    description: toStringValue(raw.description) || undefined,
    status,
    rowVersion: Number.isFinite(rowVersionRaw) ? rowVersionRaw : undefined,
    dueDate:
      raw.dueDate === null || raw.dueDate === undefined ? null : toStringValue(raw.dueDate) || null,
    completedAt:
      raw.completedAt === null || raw.completedAt === undefined
        ? null
        : toStringValue(raw.completedAt) || null,
    createdAt: toStringValue(raw.createdAt) || undefined,
    deliverableTitle: deliverableIdValue ? deliverableTitleById.get(deliverableIdValue) : undefined,
  }
}

function compareEnrichedTasks(a: EnrichedTask, b: EnrichedTask): number {
  if (a.isOverdue && !b.isOverdue) return -1
  if (!a.isOverdue && b.isOverdue) return 1

  if (!a.dueDate && b.dueDate) return 1
  if (a.dueDate && !b.dueDate) return -1

  if (a.dueDate && b.dueDate) {
    return a.dueDate.localeCompare(b.dueDate)
  }

  return 0
}

/**
 * Data and (limited) mutation surface for the supervisor Tasks tab.
 *
 * Wiring map:
 * - Intern roster   → `GET /api/supervisor/me/interns` (paged).
 * - Mission tasks   → `GET /api/tasks/by-mission/{missionId}` (flat array).
 *   This replaces the legacy fan-out over `/api/tasks/by-intern/{internId}`,
 *   which the backend has retired. A single round-trip now serves the table.
 * - Deliverable map → `GET /api/deliverables/mission/{missionId}` (used to
 *   resolve `deliverableTitle` for the task row link).
 * - Create task     → `POST /api/tasks`
 * - Update task     → Step 2 (no `PUT /api/tasks/{id}` route on the backend).
 * - Status change   → Step 2 (no supervisor-side `PUT /api/tasks/{id}/status`).
 *   Intern-side `PATCH /api/tasks/{id}/complete` exists but is gated by the
 *   `Intern` role, so it cannot be used here.
 */
export function useTasksData(missionId: string) {
  const { t } = useI18n()
  const { get, post } = useDashboardApi()

  const [tasks, setTasks] = useState<SupervisorTask[]>([])
  const [interns, setInterns] = useState<SupervisorIntern[]>([])
  const [deliverables, setDeliverables] = useState<SupervisorDeliverable[]>([])
  const [overdueCount, setOverdueCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!missionId) {
      setIsLoading(false)
      setTasks([])
      setInterns([])
      setDeliverables([])
      setOverdueCount(0)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const [internsResponse, missionDeliverables, missionTasksResponse] = await Promise.all([
        get<unknown>('/api/supervisor/me/interns'),
        get<SupervisorDeliverable[]>(`/api/deliverables/mission/${missionId}`),
        get<unknown>(`/api/tasks/by-mission/${missionId}`),
      ])

      const supervisorInterns = readListItems(internsResponse)
        .map((item) => mapSupervisorIntern(item))
        .filter((intern): intern is SupervisorIntern => intern !== null)

      const deliverableTitleById = new Map(
        missionDeliverables.map((deliverable) => [deliverable.id, deliverable.title]),
      )

      const flattened = readListItems(missionTasksResponse)
        .map((item) => mapTask(item, deliverableTitleById))
        .filter((task): task is SupervisorTask => task !== null)

      const enriched: EnrichedTask[] = flattened.map((task) => ({
        ...task,
        isOverdue: isTaskOverdue(task),
      }))

      enriched.sort(compareEnrichedTasks)

      setTasks(enriched)
      setInterns(supervisorInterns)
      setDeliverables(missionDeliverables)
      setOverdueCount(enriched.filter((task) => task.isOverdue).length)
    } catch (requestError) {
      setError(toErrorMessage(requestError, t('dashboard.error.load')))
    } finally {
      setIsLoading(false)
    }
  }, [get, t, missionId])

  // Step 2: no supervisor-side status mutation route exists on the backend.
  const updateTaskStatus = useCallback(
    async (_id: string, _status: TaskStatus): Promise<void> => {
      void _id
      void _status
      throw new NotImplementedOnBackendError('Changing a task status from the supervisor side')
    },
    [],
  )

  const createTask = useCallback(
    async (req: CreateTaskRequest): Promise<void> => {
      await post('/api/tasks', req)
      await refresh()
    },
    [post, refresh],
  )

  // Step 2: backend has no `PUT /api/tasks/{id}` route.
  const updateTask = useCallback(
    async (_id: string, _req: UpdateTaskRequest): Promise<void> => {
      void _id
      void _req
      throw new NotImplementedOnBackendError('Updating a task')
    },
    [],
  )

  useEffect(() => {
    void refresh()
    // missionId is the re-fetch trigger; refresh captures it via closure
    // and is intentionally excluded from this dep array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId])

  return {
    tasks,
    interns,
    overdueCount,
    deliverables,
    isLoading,
    error,
    refresh,
    updateTaskStatus,
    createTask,
    updateTask,
  }
}

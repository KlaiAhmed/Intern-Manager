// NOTE: Gap 2 workaround — tasks are fetched per intern via fan-out.
// Replace with GET /api/tasks/by-mission/{missionId} when available.
// See Appendix C Gap 2 for migration instructions.
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
import { toErrorMessage } from '@/features/dashboard/hooks/supervisor/utils'
import { isTaskOverdue } from '@/features/dashboard/shared/utils/supervisorUtils'

type EnrichedTask = SupervisorTask & { isOverdue: boolean }

function getMissionInterns(interns: SupervisorIntern[], missionId: string): SupervisorIntern[] {
  const hasMissionScopedInterns = interns.some((intern) => Boolean(intern.missionId))

  if (!hasMissionScopedInterns) {
    return interns
  }

  return interns.filter((intern) => intern.missionId === missionId)
}

function getDeliverableTitleById(deliverables: SupervisorDeliverable[]): Map<string, string> {
  return new Map(deliverables.map((deliverable) => [deliverable.id, deliverable.title]))
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

export function useTasksData(missionId: string) {
  const { t } = useI18n()
  const { get, post, put } = useDashboardApi()

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
      const [allSupervisorInterns, missionDeliverables] = await Promise.all([
        get<SupervisorIntern[]>('/api/supervisor/interns'),
        get<SupervisorDeliverable[]>(`/api/deliverables/mission/${missionId}`),
      ])
      const supervisorInterns = getMissionInterns(allSupervisorInterns, missionId)
      const deliverableTitleById = getDeliverableTitleById(missionDeliverables)

      if (supervisorInterns.length > 10) {
        console.warn(
          `[useTasksData] Fan-out for ${supervisorInterns.length} interns detected. ` +
            'Performance may degrade. Replace with GET /api/tasks/by-mission/{id} when available.',
        )
      }

      const perInternResponses = await Promise.all(
        supervisorInterns.map((intern) =>
          get<SupervisorTask[]>(`/api/tasks/by-intern/${intern.id}`).then((internTasks) =>
            internTasks.map((task) => ({
              ...task,
              internId: intern.id,
              deliverableTitle: task.deliverableId ? deliverableTitleById.get(task.deliverableId) : undefined,
            })),
          ),
        ),
      )

      const flattened = perInternResponses.flat()

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

  const updateTaskStatus = useCallback(
    async (id: string, status: TaskStatus): Promise<void> => {
      await put(`/api/tasks/${id}/status`, { Status: status })
      await refresh()
    },
    [put, refresh],
  )

  const createTask = useCallback(
    async (req: CreateTaskRequest): Promise<void> => {
      await post('/api/tasks', req)
      await refresh()
    },
    [post, refresh],
  )

  const updateTask = useCallback(
    async (id: string, req: UpdateTaskRequest): Promise<void> => {
      await put(`/api/tasks/${id}`, req)
      await refresh()
    },
    [put, refresh],
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

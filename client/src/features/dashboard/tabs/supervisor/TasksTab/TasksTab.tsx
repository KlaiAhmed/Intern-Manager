import { useEffect, useMemo, useRef, useState } from 'react'

import { Input } from '@/components/ui/Input'
import { DashboardButton } from '@/features/dashboard/components/DashboardButton'
import { ErrorState } from '@/features/dashboard/components/ErrorState'
import { Plus, Search } from '@/features/dashboard/components/IconComponents'
import { Panel } from '@/features/dashboard/components/Panel'
import { Skeleton } from '@/features/dashboard/components/Skeleton'
import { Toast } from '@/features/dashboard/components/Toast/Toast'
import { useToast } from '@/features/dashboard/components/Toast/useToast'
import { TaskDrawer } from '@/features/dashboard/tabs/supervisor/shared/components/TaskDrawer'
import type {
  CreateTaskRequest,
  SupervisorIntern,
  SupervisorTask,
  TaskStatus,
  UpdateTaskRequest,
} from '@/features/dashboard/types/supervisorDashboard'
import { useI18n } from '@/locales/I18nContext'

import {
  InternTaskGroup,
  type InternTaskGroupAction,
} from './components/InternTaskGroup'
import { VerifyDrawer } from './components/VerifyDrawer'
import { useTasksData } from './hooks/useTasksData'

interface TasksTabProps {
  missionId: string
}

type TaskFilterStatus = TaskStatus | 'all'
type DrawerMode = 'verify' | 'create' | 'edit' | null

const statusFilterOrder: TaskFilterStatus[] = [
  'all',
  'todo',
  'in_progress',
  'done',
  'reopened',
]

function getTaskStatusFilterLabel(status: TaskFilterStatus, t: (key: string) => string): string {
  return status === 'all'
    ? t('dashboard.supervisor.tasks.status.all')
    : t(`dashboard.supervisor.tasks.status.${status}`)
}

function groupTasksByInternId(tasks: SupervisorTask[]): Map<string, SupervisorTask[]> {
  const tasksByInternId = new Map<string, SupervisorTask[]>()

  for (const task of tasks) {
    const internTasks = tasksByInternId.get(task.internId) ?? []
    internTasks.push(task)
    tasksByInternId.set(task.internId, internTasks)
  }

  return tasksByInternId
}

function getInternNameById(interns: SupervisorIntern[]): Map<string, string> {
  return new Map(interns.map((intern) => [intern.id, intern.fullName]))
}

export function TasksTab({ missionId }: TasksTabProps) {
  const { t } = useI18n()
  const {
    tasks,
    interns,
    deliverables,
    overdueCount,
    isLoading,
    error,
    refresh,
    updateTaskStatus,
    createTask,
    updateTask,
  } = useTasksData(missionId)
  const { toasts, showToast, dismissToast } = useToast()
  const [filterInternId, setFilterInternId] = useState<string | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<TaskFilterStatus>('all')
  const [searchText, setSearchText] = useState('')
  const [expandedInternIds, setExpandedInternIds] = useState<Set<string>>(new Set())
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null)
  const [selectedTask, setSelectedTask] = useState<SupervisorTask | null>(null)
  const initializedExpandedInternsRef = useRef(false)

  useEffect(() => {
    if (initializedExpandedInternsRef.current || interns.length === 0) {
      return
    }

    setExpandedInternIds((currentIds) => {
      if (currentIds.size !== 0) {
        return currentIds
      }

      initializedExpandedInternsRef.current = true
      return new Set(interns.map((intern) => intern.id))
    })
  }, [interns])

  const filteredTasks = useMemo(() => {
    let nextTasks = tasks

    if (filterInternId !== 'all') {
      nextTasks = nextTasks.filter((task) => task.internId === filterInternId)
    }

    if (filterStatus !== 'all') {
      nextTasks = nextTasks.filter((task) => task.status === filterStatus)
    }

    const normalizedSearch = searchText.trim().toLocaleLowerCase()
    if (normalizedSearch) {
      nextTasks = nextTasks.filter((task) => {
        const searchableText = [
          task.title,
          task.description,
          task.deliverableTitle,
        ].filter(Boolean).join(' ').toLocaleLowerCase()

        return searchableText.includes(normalizedSearch)
      })
    }

    return nextTasks
  }, [filterInternId, filterStatus, searchText, tasks])

  const tasksByInternId = useMemo(() => groupTasksByInternId(filteredTasks), [filteredTasks])
  const internNameById = useMemo(() => getInternNameById(interns), [interns])
  const allInternIds = useMemo(() => interns.map((intern) => intern.id), [interns])
  const isEveryInternExpanded = allInternIds.length > 0 && allInternIds.every((internId) => expandedInternIds.has(internId))

  const closeDrawer = () => {
    setDrawerMode(null)
    setSelectedTask(null)
  }

  const handleTaskDrawerSubmit = async (request: CreateTaskRequest | UpdateTaskRequest) => {
    if (drawerMode === 'edit' && selectedTask) {
      await updateTask(selectedTask.id, request as UpdateTaskRequest)
    } else {
      await createTask(request as CreateTaskRequest)
    }

    showToast(t('dashboard.supervisor.toast.saveSuccess'), 'success')
  }

  const handleTaskAction = (action: InternTaskGroupAction) => {
    if (action.type === 'edit') {
      setSelectedTask(action.task)
      setDrawerMode('edit')
      return
    }

    if (action.type === 'verify') {
      setSelectedTask(action.task)
      setDrawerMode('verify')
      return
    }

    void updateTaskStatus(action.task.id, action.status)
      .then(() => {
        showToast(t('dashboard.supervisor.toast.saveSuccess'), 'success')
      })
      .catch((requestError: unknown) => {
        const message = requestError instanceof Error ? requestError.message : t('dashboard.supervisor.error.save')
        showToast(message, 'error')
      })
  }

  const toggleIntern = (internId: string) => {
    setExpandedInternIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(internId)) {
        nextIds.delete(internId)
      } else {
        nextIds.add(internId)
      }

      return nextIds
    })
  }

  const toggleAllInterns = () => {
    setExpandedInternIds(isEveryInternExpanded ? new Set() : new Set(allInternIds))
  }

  if (isLoading) {
    return (
      <Panel title={t('dashboard.supervisor.tasks.title')}>
        <div className="supervisor-tasks-skeleton">
          <Skeleton height="44px" />
          <Skeleton height="120px" />
          <Skeleton height="120px" />
        </div>
      </Panel>
    )
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => { void refresh() }} />
  }

  return (
    <>
      <Panel title={t('dashboard.supervisor.tasks.title')}>
        <div className="supervisor-tasks-tab">
          {overdueCount > 0 && (
            <div className="supervisor-tasks-overdue" role="status">
              <div className="supervisor-tasks-overdue__message">
                <span className="supervisor-tasks-overdue__icon" aria-hidden="true">&#9888;</span>
                <span>{t('dashboard.supervisor.tasks.overdueBanner', { count: overdueCount })}</span>
              </div>
              <DashboardButton type="button" variant="ghost" size="sm" onClick={() => setFilterStatus('todo')}>
                {t('dashboard.supervisor.tasks.showOverdue')}
              </DashboardButton>
            </div>
          )}

          <div className="supervisor-tasks-toolbar">
            <label className="supervisor-tasks-toolbar__select">
              <span>{t('dashboard.form.intern')}</span>
              <select
                className="dash-input dash-select"
                value={filterInternId}
                onChange={(event) => setFilterInternId(event.target.value)}
              >
                <option value="all">{t('dashboard.supervisor.tasks.allInterns')}</option>
                {interns.map((intern) => (
                  <option key={intern.id} value={intern.id}>
                    {intern.fullName}
                  </option>
                ))}
              </select>
            </label>

            <label className="supervisor-tasks-toolbar__select">
              <span>{t('dashboard.form.status')}</span>
              <select
                className="dash-input dash-select"
                value={filterStatus}
                onChange={(event) => setFilterStatus(event.target.value as TaskFilterStatus)}
                aria-label={t('dashboard.supervisor.tasks.statusFilter')}
              >
                {statusFilterOrder.map((status) => (
                  <option key={status} value={status}>
                    {getTaskStatusFilterLabel(status, t)}
                  </option>
                ))}
              </select>
            </label>

            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t('dashboard.supervisor.tasks.searchPlaceholder')}
              leftIcon={<Search />}
              aria-label={t('dashboard.supervisor.tasks.searchLabel')}
            />

            <div className="supervisor-tasks-toolbar__actions">
              <DashboardButton type="button" variant="secondary" size="sm" onClick={toggleAllInterns}>
                {isEveryInternExpanded ? t('dashboard.supervisor.tasks.collapseAll') : t('dashboard.supervisor.tasks.expandAll')}
              </DashboardButton>
              <DashboardButton type="button" variant="primary" size="sm" onClick={() => setDrawerMode('create')}>
                <Plus />
                {t('dashboard.supervisor.tasks.addTask')}
              </DashboardButton>
            </div>
          </div>

          {filteredTasks.length > 0 ? (
            <div className="supervisor-tasks-list">
              {interns.map((intern) => {
                const internTasks = tasksByInternId.get(intern.id)

                if (!internTasks || internTasks.length === 0) {
                  return null
                }

                return (
                  <InternTaskGroup
                    key={intern.id}
                    intern={intern}
                    tasks={internTasks}
                    isExpanded={expandedInternIds.has(intern.id)}
                    onToggle={() => toggleIntern(intern.id)}
                    onTaskAction={handleTaskAction}
                  />
                )
              })}
            </div>
          ) : (
            <div className="dash-empty">
              <h3 className="dash-empty-title">{t('dashboard.supervisor.tasks.emptyTitle')}</h3>
              <p className="dash-empty-description">{t('dashboard.supervisor.tasks.emptyMessage')}</p>
            </div>
          )}
        </div>
      </Panel>

      <TaskDrawer
        isOpen={drawerMode === 'create' || drawerMode === 'edit'}
        mode={drawerMode === 'edit' ? 'edit' : 'create'}
        task={selectedTask}
        missionInterns={interns.map((intern) => ({
          internId: intern.id,
          internName: intern.fullName,
        }))}
        deliverables={deliverables}
        onClose={closeDrawer}
        onSubmit={handleTaskDrawerSubmit}
        showToast={showToast}
      />

      {selectedTask && drawerMode === 'verify' && (
        <VerifyDrawer
          isOpen
          task={selectedTask}
          internName={internNameById.get(selectedTask.internId) ?? selectedTask.internId}
          onClose={closeDrawer}
          updateTaskStatus={updateTaskStatus}
          showToast={showToast}
        />
      )}

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}

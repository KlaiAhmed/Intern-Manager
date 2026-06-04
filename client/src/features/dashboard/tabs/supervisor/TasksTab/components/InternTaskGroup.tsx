import { useId } from 'react'

import { Avatar } from '@/features/dashboard/components/Avatar/Avatar'
import { ChevronDown } from '@/features/dashboard/components/IconComponents'
import type {
  SupervisorIntern,
  SupervisorTask,
  TaskStatus,
} from '@/features/dashboard/types/supervisorDashboard'
import { useI18n } from '@/locales/I18nContext'

import { TaskRow } from './TaskRow'

export type InternTaskGroupAction =
  | { type: 'edit'; task: SupervisorTask }
  | { type: 'status'; task: SupervisorTask; status: TaskStatus }
  | { type: 'verify'; task: SupervisorTask }

interface InternTaskGroupProps {
  intern: SupervisorIntern
  tasks: SupervisorTask[]
  isExpanded: boolean
  onToggle: () => void
  onTaskAction: (action: InternTaskGroupAction) => void
}

export function InternTaskGroup({
  intern,
  tasks,
  isExpanded,
  onToggle,
  onTaskAction,
}: InternTaskGroupProps) {
  const { t } = useI18n()
  const bodyId = useId()

  return (
    <section className="supervisor-task-group">
      <button
        className="supervisor-task-group__header"
        type="button"
        aria-expanded={isExpanded}
        aria-controls={bodyId}
        onClick={onToggle}
      >
        <span className="supervisor-task-group__title">
          <Avatar name={intern.fullName} size="xs" />
          <span>{intern.fullName}</span>
          <span className="supervisor-task-group__count">
            {t('dashboard.supervisor.tasks.count', { count: tasks.length })}
          </span>
        </span>
        <span className={`supervisor-task-group__caret ${isExpanded ? 'is-open' : ''}`} aria-hidden="true">
          <ChevronDown />
        </span>
      </button>

      {isExpanded && (
        <div id={bodyId} className="supervisor-task-group__body">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              internName={intern.fullName}
              onEditClick={(nextTask) => onTaskAction({ type: 'edit', task: nextTask })}
              onStatusAction={(nextTask, action) => {
                if (action === 'verify') {
                  onTaskAction({ type: 'verify', task: nextTask })
                  return
                }

                onTaskAction({ type: 'status', task: nextTask, status: action })
              }}
            />
          ))}
        </div>
      )}
    </section>
  )
}

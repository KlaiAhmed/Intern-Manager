import { format, parseISO } from 'date-fns'
import type { CSSProperties } from 'react'

import { DashboardButton } from '@/features/dashboard/components/DashboardButton'
import { Edit } from '@/features/dashboard/components/IconComponents'
import { StatusBadge } from '@/features/dashboard/components/StatusBadge'
import { getTaskStatusTone, isTaskOverdue } from '@/features/dashboard/shared/utils/supervisorUtils'
import type {
  StatusTone,
  SupervisorTask,
  TaskStatus,
} from '@/features/dashboard/types/supervisorDashboard'
import { useI18n } from '@/locales/I18nContext'

interface TaskRowProps {
  task: SupervisorTask
  internName: string
  onEditClick: (task: SupervisorTask) => void
  onStatusAction: (task: SupervisorTask, action: TaskStatus | 'verify') => void
}

interface TaskStatusAction {
  labelKey: string
  action: TaskStatus | 'verify'
}

const statusActionTable: Partial<Record<TaskStatus, TaskStatusAction>> = {
  todo: {
    labelKey: 'dashboard.supervisor.tasks.actions.markInProgress',
    action: 'in_progress',
  },
  in_progress: {
    labelKey: 'dashboard.supervisor.tasks.actions.markDone',
    action: 'done',
  },
  done: {
    labelKey: 'dashboard.supervisor.tasks.actions.verify',
    action: 'verify',
  },
  reopened: {
    labelKey: 'dashboard.supervisor.tasks.actions.markInProgress',
    action: 'in_progress',
  },
}

const statusToneVariableMap: Record<StatusTone, string> = {
  neutral: 'var(--dash-border-hover)',
  info: 'var(--dash-accent)',
  success: 'var(--dash-success)',
  warning: 'var(--dash-warning)',
  danger: 'var(--dash-error)',
}

function formatDueDate(value: string | null | undefined, fallback: string): string {
  if (!value) {
    return fallback
  }

  const parsedDate = parseISO(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return format(parsedDate, 'MMM d, yyyy')
}

function getTaskBorderColor(status: TaskStatus): string {
  return statusToneVariableMap[getTaskStatusTone(status)]
}

export function getTaskStatusLabel(status: TaskStatus, t: (key: string) => string): string {
  return t(`dashboard.supervisor.tasks.status.${status}`)
}

export function TaskRow({
  task,
  internName,
  onEditClick,
  onStatusAction,
}: TaskRowProps) {
  const { t } = useI18n()
  const statusAction = statusActionTable[task.status]
  const rowStyle: CSSProperties = {
    borderLeftColor: getTaskBorderColor(task.status),
    ...(isTaskOverdue(task)
      ? { background: 'color-mix(in srgb, var(--dash-warning) 8%, transparent)' }
      : {}),
  }

  return (
    <article className="supervisor-task-row" style={rowStyle}>
      <div className="supervisor-task-row__content">
        <div className="supervisor-task-row__headline">
          <h3>{task.title}</h3>
          <StatusBadge label={getTaskStatusLabel(task.status, t)} tone={getTaskStatusTone(task.status)} size="sm" />
        </div>
        <div className="supervisor-task-row__meta">
          <span>{internName}</span>
          <span>{formatDueDate(task.dueDate, t('dashboard.supervisor.tasks.noDueDate'))}</span>
          {task.deliverableTitle && (
            <span className="supervisor-task-row__muted">
              {t('dashboard.supervisor.tasks.linkedDeliverable', { name: task.deliverableTitle })}
            </span>
          )}
        </div>
      </div>

      <div className="supervisor-task-row__actions">
        <DashboardButton
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t('dashboard.supervisor.tasks.actions.edit')}
          onClick={() => onEditClick(task)}
        >
          <Edit />
        </DashboardButton>

        {statusAction && (
          <DashboardButton
            type="button"
            variant={statusAction.action === 'verify' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => onStatusAction(task, statusAction.action)}
          >
            {t(statusAction.labelKey)}
          </DashboardButton>
        )}
      </div>
    </article>
  )
}

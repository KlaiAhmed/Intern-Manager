import { format, parseISO } from 'date-fns'
import { useEffect, useState } from 'react'

import { DashboardButton } from '@/features/dashboard/components/DashboardButton'
import { Drawer } from '@/features/dashboard/components/Drawer/Drawer'
import { StatusBadge } from '@/features/dashboard/components/StatusBadge'
import type { ToastTone } from '@/features/dashboard/components/Toast/useToast'
import { getTaskStatusTone } from '@/features/dashboard/shared/utils/supervisorUtils'
import type {
  SupervisorTask,
  TaskStatus,
} from '@/features/dashboard/types/supervisorDashboard'
import { useI18n } from '@/locales/I18nContext'

import { getTaskStatusLabel } from './TaskRow'

interface VerifyDrawerProps {
  isOpen: boolean
  task: SupervisorTask
  internName: string
  onClose: () => void
  updateTaskStatus: (id: string, status: TaskStatus) => Promise<void>
  showToast: (message: string, tone: ToastTone) => void
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

export function VerifyDrawer({
  isOpen,
  task,
  internName,
  onClose,
  updateTaskStatus,
  showToast,
}: VerifyDrawerProps) {
  const { t } = useI18n()
  const [feedback, setFeedback] = useState('')
  const [isSendingBack, setIsSendingBack] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setFeedback('')
    }
  }, [isOpen, task.id])

  const handleConfirmComplete = () => {
    // TODO: wire to backend task verification endpoint when available.
    onClose()
    showToast(t('dashboard.supervisor.toast.saveSuccess'), 'success')
  }

  const handleSendBack = async () => {
    setIsSendingBack(true)

    try {
      await updateTaskStatus(task.id, 'reopened')
      onClose()
      showToast(t('dashboard.supervisor.toast.saveSuccess'), 'success')
    } catch (error) {
      const message = error instanceof Error ? error.message : t('dashboard.supervisor.error.save')
      showToast(message, 'error')
    } finally {
      setIsSendingBack(false)
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('dashboard.supervisor.tasks.verifyTitle')}
      width="md"
      footer={(
        <div className="supervisor-task-verify__footer">
          <DashboardButton type="button" variant="secondary" size="sm" onClick={onClose} disabled={isSendingBack}>
            {t('dashboard.form.cancel')}
          </DashboardButton>
          <DashboardButton
            type="button"
            variant="secondary"
            size="sm"
            loading={isSendingBack}
            onClick={() => {
              void handleSendBack()
            }}
          >
            {t('dashboard.supervisor.tasks.actions.sendBack')}
          </DashboardButton>
          <DashboardButton type="button" variant="primary" size="sm" onClick={handleConfirmComplete} disabled={isSendingBack}>
            {t('dashboard.supervisor.tasks.actions.confirmComplete')}
          </DashboardButton>
        </div>
      )}
    >
      <div className="supervisor-task-verify">
        <div className="supervisor-task-verify__context">
          <h3>{task.title}</h3>
          <p>{internName}</p>
        </div>

        <dl className="supervisor-task-verify__details">
          <div>
            <dt>{t('dashboard.form.dueDate')}</dt>
            <dd>{formatDueDate(task.dueDate, t('dashboard.supervisor.tasks.noDueDate'))}</dd>
          </div>
          <div>
            <dt>{t('dashboard.form.status')}</dt>
            <dd>
              <StatusBadge label={getTaskStatusLabel(task.status, t)} tone={getTaskStatusTone(task.status)} size="sm" />
            </dd>
          </div>
        </dl>

        <label className="supervisor-task-verify__field" htmlFor="task-verify-feedback">
          <span>{t('dashboard.supervisor.form.feedback')}</span>
          <textarea
            id="task-verify-feedback"
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            rows={5}
          />
          <small>{t('dashboard.supervisor.form.feedbackHelperText')}</small>
        </label>
      </div>
    </Drawer>
  )
}

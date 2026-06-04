import { useMemo, useState } from 'react'
import { format } from 'date-fns'

import { Avatar } from '@/features/dashboard/components/Avatar/Avatar'
import { DashboardButton } from '@/features/dashboard/components/DashboardButton'
import { Drawer } from '@/features/dashboard/components/Drawer/Drawer'
import { Download, Eye } from '@/features/dashboard/components/IconComponents'
import type { ToastTone } from '@/features/dashboard/components/Toast/useToast'
import type {
  RejectDeliverableRequest,
  SupervisorDeliverable,
  SupervisorIntern,
  SupervisorTask,
} from '@/features/dashboard/types/supervisorDashboard'
import { useI18n } from '@/locales/I18nContext'

import { ConflictError } from '../hooks/useDeliverablesData'
import { getCurrentVersion } from './InternDeliverableCard'

interface RejectDrawerProps {
  deliverable: SupervisorDeliverable
  intern: SupervisorIntern | undefined
  tasks: SupervisorTask[]
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  rejectDeliverable: (id: string, req: RejectDeliverableRequest) => Promise<void>
  showToast: (message: string, tone: ToastTone) => void
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return format(date, 'MMM d, yyyy HH:mm')
}

function getInternName(deliverable: SupervisorDeliverable, intern: SupervisorIntern | undefined): string {
  return intern?.fullName || deliverable.internName || 'Unassigned intern'
}

export function RejectDrawer({
  deliverable,
  intern,
  tasks,
  isOpen,
  onClose,
  onSuccess,
  rejectDeliverable,
  showToast,
}: RejectDrawerProps) {
  const { t } = useI18n()
  const [instructions, setInstructions] = useState('')
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [validationMessage, setValidationMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const internName = getInternName(deliverable, intern)
  const currentVersion = getCurrentVersion(deliverable)
  const linkedTasks = useMemo(
    () => tasks.filter((task) => task.deliverableId === deliverable.id),
    [deliverable.id, tasks],
  )

  const handleSubmit = async () => {
    const trimmedInstructions = instructions.trim()
    if (trimmedInstructions.length < 10) {
      setValidationMessage(t('dashboard.supervisor.deliverables.instructionsMin'))
      return
    }

    setValidationMessage(null)
    setIsSubmitting(true)

    try {
      await rejectDeliverable(deliverable.id, {
        Reason: trimmedInstructions,
        TaskIdsToReopen: selectedTaskIds,
        RowVersion: deliverable.rowVersion ?? '',
      })
      showToast(t('dashboard.supervisor.toast.rejectSuccess'), 'success')
      onSuccess()
    } catch (error) {
      if (error instanceof ConflictError) {
        showToast(t('dashboard.supervisor.toast.concurrentEdit'), 'error')
        return
      }

      showToast(t('dashboard.supervisor.error.reject'), 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('dashboard.supervisor.deliverables.rejectTitle')}
      width="md"
      footer={(
        <>
          <DashboardButton type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {t('dashboard.form.cancel')}
          </DashboardButton>
          <DashboardButton type="button" variant="primary" loading={isSubmitting} onClick={() => void handleSubmit()}>
            {t('dashboard.supervisor.deliverables.sendChanges')}
          </DashboardButton>
        </>
      )}
    >
      <div className="supervisor-deliverable-drawer">
        <div className="supervisor-deliverable-drawer__context">
          <Avatar name={internName} size="md" />
          <div>
            <strong>{internName}</strong>
            <span>{deliverable.title}</span>
          </div>
        </div>

        <dl className="supervisor-deliverable-drawer__details">
          <div>
            <dt>{t('dashboard.supervisor.deliverables.version')}</dt>
            <dd>{currentVersion ? `v${currentVersion.versionNumber}` : `v${deliverable.version}`}</dd>
          </div>
          <div>
            <dt>{t('dashboard.supervisor.deliverables.submissionDate')}</dt>
            <dd>{formatDateTime(deliverable.submittedDate ?? currentVersion?.submittedAt)}</dd>
          </div>
        </dl>

        <div className="supervisor-deliverable-drawer__links">
          {currentVersion?.fileUrl && (
            <a href={currentVersion.fileUrl} target="_blank" rel="noopener noreferrer">
              <Download />
              <span>{t('dashboard.supervisor.deliverables.downloadFile')}</span>
            </a>
          )}
          {currentVersion?.gitHubUrl && (
            <a href={currentVersion.gitHubUrl} target="_blank" rel="noopener noreferrer">
              <Eye />
              <span>{t('dashboard.supervisor.deliverables.viewGithub')}</span>
            </a>
          )}
        </div>

        {currentVersion?.message && (
          <blockquote className="supervisor-deliverable-drawer__message">
            {currentVersion.message}
          </blockquote>
        )}

        <label className="supervisor-deliverable-drawer__field">
          <span>{t('dashboard.supervisor.deliverables.instructions')}</span>
          <textarea
            value={instructions}
            rows={5}
            minLength={10}
            required
            disabled={isSubmitting}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder={t('dashboard.supervisor.deliverables.instructionsPlaceholder')}
          />
        </label>

        {linkedTasks.length > 0 && (
          <fieldset className="supervisor-deliverable-drawer__tasks">
            <legend>{t('dashboard.supervisor.deliverables.reopenTasks')}</legend>
            {linkedTasks.map((task) => (
              <label key={task.id}>
                <input
                  type="checkbox"
                  checked={selectedTaskIds.includes(task.id)}
                  disabled={isSubmitting}
                  onChange={(event) => {
                    setSelectedTaskIds((currentIds) =>
                      event.target.checked
                        ? [...currentIds, task.id]
                        : currentIds.filter((taskId) => taskId !== task.id),
                    )
                  }}
                />
                <span>{task.title}</span>
              </label>
            ))}
          </fieldset>
        )}

        {validationMessage && (
          <p className="supervisor-deliverable-drawer__error" role="alert">
            {validationMessage}
          </p>
        )}
      </div>
    </Drawer>
  )
}

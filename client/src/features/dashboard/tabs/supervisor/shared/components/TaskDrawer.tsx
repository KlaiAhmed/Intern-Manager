import { useEffect, useState, type FormEvent } from 'react'
import { Drawer } from '../../../../components/Drawer/Drawer'
import { DashboardButton } from '../../../../components/DashboardButton'
import { useI18n } from '../../../../../../locales/I18nContext'
import type {
  CreateTaskRequest,
  SupervisorDeliverable,
  SupervisorTask,
  UpdateTaskRequest,
} from '../../../../types/supervisorDashboard'
import type { ToastTone } from '../../../../components/Toast/useToast'

export interface TaskDrawerMissionIntern {
  internId: string
  internName: string
}

interface TaskDrawerProps {
  isOpen: boolean
  mode: 'create' | 'edit'
  task?: SupervisorTask | null
  missionInterns: TaskDrawerMissionIntern[]
  deliverables: SupervisorDeliverable[]
  onClose: () => void
  onSubmit: (req: CreateTaskRequest | UpdateTaskRequest) => Promise<void>
  showToast: (message: string, tone: ToastTone) => void
}

interface FormValues {
  title: string
  description: string
  dueDate: string
  internId: string
  deliverableId: string
}

interface FormErrors {
  title?: string
}

const emptyFormValues: FormValues = {
  title: '',
  description: '',
  dueDate: '',
  internId: '',
  deliverableId: '',
}

function valuesFromTask(task: SupervisorTask | null | undefined): FormValues {
  if (!task) {
    return { ...emptyFormValues }
  }

  return {
    title: task.title ?? '',
    description: task.description ?? '',
    dueDate: task.dueDate ?? '',
    internId: task.internId ?? '',
    deliverableId: task.deliverableId ?? '',
  }
}

export function TaskDrawer({
  isOpen,
  mode,
  task,
  missionInterns,
  deliverables,
  onClose,
  onSubmit,
  showToast,
}: TaskDrawerProps) {
  const { t } = useI18n()
  const [formValues, setFormValues] = useState<FormValues>(emptyFormValues)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      return
    }
    setFormErrors({})
    setFormValues(valuesFromTask(task))
  }, [isOpen, task, mode])

  const handleFieldChange = (field: keyof FormValues, value: string) => {
    setFormValues((previous) => ({ ...previous, [field]: value }))
    if (field === 'title' && formErrors.title) {
      setFormErrors((previous) => ({ ...previous, title: undefined }))
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedTitle = formValues.title.trim()
    if (trimmedTitle === '') {
      setFormErrors({ title: t('dashboard.supervisor.taskDrawer.titleRequired') })
      return
    }

    setIsSubmitting(true)
    try {
      const request: CreateTaskRequest | UpdateTaskRequest =
        mode === 'create'
          ? {
              InternId: formValues.internId,
              Title: trimmedTitle,
              ...(formValues.description.trim() !== '' ? { Description: formValues.description } : {}),
              ...(formValues.dueDate !== '' ? { DueDate: formValues.dueDate } : {}),
              ...(formValues.deliverableId !== '' ? { DeliverableId: formValues.deliverableId } : {}),
            }
          : {
              Title: trimmedTitle,
              ...(formValues.description.trim() !== '' ? { Description: formValues.description } : {}),
              ...(formValues.dueDate !== '' ? { DueDate: formValues.dueDate } : {}),
              ...(formValues.deliverableId !== '' ? { DeliverableId: formValues.deliverableId } : {}),
            }

      await onSubmit(request)
      onClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      showToast(message, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const drawerTitle =
    mode === 'create' ? t('dashboard.supervisor.taskDrawer.createTitle') : t('dashboard.supervisor.taskDrawer.editTitle')

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={drawerTitle}
      width="md"
      footer={(
        <div className="task-form-footer">
          <DashboardButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t('dashboard.form.cancel')}
          </DashboardButton>
          <DashboardButton
            type="submit"
            variant="primary"
            size="sm"
            form="task-drawer-form"
            disabled={isSubmitting}
          >
            {t('dashboard.form.submit')}
          </DashboardButton>
        </div>
      )}
    >
      <form id="task-drawer-form" className="task-form-modal" onSubmit={handleSubmit}>
        <div className="task-form-body">
          <div className="task-form-field">
            <label htmlFor="task-drawer-intern" className="task-form-label">
              {t('dashboard.supervisor.taskDrawer.intern')}
            </label>
            <div className="task-form-select-wrapper">
              <select
                id="task-drawer-intern"
                className="task-form-select"
                value={formValues.internId}
                onChange={(event) => handleFieldChange('internId', event.target.value)}
                disabled={isSubmitting}
              >
                <option value="" disabled>
                  {t('dashboard.supervisor.taskDrawer.selectIntern')}
                </option>
                {missionInterns.map((intern) => (
                  <option key={intern.internId} value={intern.internId}>
                    {intern.internName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="task-form-field">
            <label htmlFor="task-drawer-title" className="task-form-label">
              {t('dashboard.form.title')}
            </label>
            <input
              id="task-drawer-title"
              type="text"
              className="task-form-input"
              value={formValues.title}
              onChange={(event) => handleFieldChange('title', event.target.value)}
              disabled={isSubmitting}
            />
            {formErrors.title && (
              <span className="task-form-error" role="alert">
                {formErrors.title}
              </span>
            )}
          </div>

          <div className="task-form-field">
            <label htmlFor="task-drawer-description" className="task-form-label">
              {t('dashboard.form.description')}
            </label>
            <textarea
              id="task-drawer-description"
              className="task-form-textarea"
              value={formValues.description}
              onChange={(event) => handleFieldChange('description', event.target.value)}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          <div className="task-form-field">
            <label htmlFor="task-drawer-dueDate" className="task-form-label">
              {t('dashboard.form.dueDate')}
            </label>
            <input
              id="task-drawer-dueDate"
              type="date"
              className="task-form-input"
              value={formValues.dueDate}
              onChange={(event) => handleFieldChange('dueDate', event.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="task-form-field">
            <label htmlFor="task-drawer-deliverable" className="task-form-label">
              {t('dashboard.supervisor.taskDrawer.deliverable')}
            </label>
            <div className="task-form-select-wrapper">
              <select
                id="task-drawer-deliverable"
                className="task-form-select"
                value={formValues.deliverableId}
                onChange={(event) => handleFieldChange('deliverableId', event.target.value)}
                disabled={isSubmitting}
              >
                <option value="">{t('dashboard.supervisor.taskDrawer.noDeliverable')}</option>
                {deliverables.map((deliverable) => (
                  <option key={deliverable.id} value={deliverable.id}>
                    {deliverable.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </form>
    </Drawer>
  )
}

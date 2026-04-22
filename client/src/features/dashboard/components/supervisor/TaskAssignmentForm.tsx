import { useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { DashboardButton } from '../DashboardButton'
import { Modal } from '../Modal'
import './TaskAssignmentForm.css'

interface InternOption {
  id: string
  fullName: string
}

interface TaskAssignmentFormProps {
  internOptions: InternOption[]
  taskForm: {
    internId: string
    title: string
    description: string
    dueDate: string
  }
  taskFormError: string | null
  submitError: string | null
  isSubmitting: boolean
  onFieldChange: (field: 'internId' | 'title' | 'description' | 'dueDate', value: string) => void
  onSubmit: () => Promise<void>
}

export function TaskAssignmentForm({
  internOptions,
  taskForm,
  taskFormError,
  submitError,
  isSubmitting,
  onFieldChange,
  onSubmit,
}: TaskAssignmentFormProps) {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await onSubmit()
      setIsOpen(false)
    } catch {
      // Error is handled by parent component
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      setIsOpen(false)
    }
  }

  const hasError = taskFormError || submitError

  return (
    <div className="task-form-trigger-wrapper">
      <button
        type="button"
        className="task-form-trigger"
        onClick={() => setIsOpen(true)}
        disabled={internOptions.length === 0}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M12 5V19M5 12H19"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>{t('dashboard.supervisor.tasks.quickAdd')}</span>
      </button>

      {internOptions.length === 0 && (
        <p className="task-form-trigger-helper">{t('dashboard.supervisor.tasks.noInterns')}</p>
      )}

      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={t('dashboard.supervisor.tasks.quickAdd')}
      >
        <form className="task-form-modal" onSubmit={handleSubmit}>
          <div className="task-form-body">
            <div className="task-form-field">
              <label htmlFor="task-intern" className="task-form-label">
                {t('dashboard.form.intern')}
              </label>
              <div className="task-form-select-wrapper">
                <select
                  id="task-intern"
                  className="task-form-select"
                  value={taskForm.internId}
                  onChange={(e) => onFieldChange('internId', e.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="" className="task-form-option-placeholder">
                    Select intern...
                  </option>
                  {internOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.fullName}
                    </option>
                  ))}
                </select>
                <svg
                  className="task-form-select-arrow"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M4 6L8 10L12 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            <div className="task-form-field">
              <label htmlFor="task-title" className="task-form-label">
                {t('dashboard.form.title')}
              </label>
              <input
                id="task-title"
                type="text"
                className="task-form-input"
                value={taskForm.title}
                onChange={(e) => onFieldChange('title', e.target.value)}
                placeholder="Enter task title..."
                disabled={isSubmitting}
              />
            </div>

            <div className="task-form-field">
              <label htmlFor="task-description" className="task-form-label">
                {t('dashboard.form.description')}
                <span className="task-form-optional">optional</span>
              </label>
              <textarea
                id="task-description"
                className="task-form-textarea"
                value={taskForm.description}
                onChange={(e) => onFieldChange('description', e.target.value)}
                placeholder="Add task description..."
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            <div className="task-form-field">
              <label htmlFor="task-dueDate" className="task-form-label">
                {t('dashboard.form.dueDate')}
                <span className="task-form-optional">optional</span>
              </label>
              <input
                id="task-dueDate"
                type="date"
                className="task-form-input"
                value={taskForm.dueDate}
                onChange={(e) => onFieldChange('dueDate', e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {hasError && (
              <div className="task-form-error">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M8 5V8.5M8 11H8.01M14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8Z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>{taskFormError ?? submitError}</span>
              </div>
            )}
          </div>

          <div className="task-form-footer">
            <DashboardButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              {t('dashboard.form.cancel')}
            </DashboardButton>
            <DashboardButton
              type="submit"
              variant="primary"
              size="sm"
              loading={isSubmitting}
              disabled={internOptions.length === 0}
            >
              {t('dashboard.supervisor.tasks.assign')}
            </DashboardButton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
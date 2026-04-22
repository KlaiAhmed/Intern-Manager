import { useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { DashboardButton } from '../DashboardButton'
import { Modal } from '../Modal'
import './DeliverableAssignmentForm.css'

interface InternOption {
  id: string
  fullName: string
}

interface MissionOption {
  id: string
  title: string
}

interface DeliverableAssignmentFormProps {
  internOptions: InternOption[]
  missionOptions: MissionOption[]
  deliverableForm: {
    internId: string
    missionId: string
    title: string
    description: string
    dueDate: string
  }
  deliverableFormError: string | null
  submitError: string | null
  isSubmitting: boolean
  onFieldChange: (field: 'internId' | 'missionId' | 'title' | 'description' | 'dueDate', value: string) => void
  onSubmit: () => Promise<void>
}

export function DeliverableAssignmentForm({
  internOptions,
  missionOptions,
  deliverableForm,
  deliverableFormError,
  submitError,
  isSubmitting,
  onFieldChange,
  onSubmit,
}: DeliverableAssignmentFormProps) {
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

  const hasError = deliverableFormError || submitError

  return (
    <div className="deliverable-form-trigger-wrapper">
      <button
        type="button"
        className="deliverable-form-trigger"
        onClick={() => setIsOpen(true)}
        disabled={internOptions.length === 0 || missionOptions.length === 0}
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
        <span>{t('dashboard.supervisor.deliverables.quickAdd')}</span>
      </button>

      {(internOptions.length === 0 || missionOptions.length === 0) && (
        <p className="deliverable-form-trigger-helper">{t('dashboard.supervisor.deliverables.noOptions')}</p>
      )}

      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={t('dashboard.supervisor.deliverables.quickAdd')}
      >
        <form className="deliverable-form-modal" onSubmit={handleSubmit}>
          <div className="deliverable-form-body">
            <div className="deliverable-form-field">
              <label htmlFor="deliverable-intern" className="deliverable-form-label">
                {t('dashboard.form.intern')}
              </label>
              <div className="deliverable-form-select-wrapper">
                <select
                  id="deliverable-intern"
                  className="deliverable-form-select"
                  value={deliverableForm.internId}
                  onChange={(e) => onFieldChange('internId', e.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="" className="deliverable-form-option-placeholder">
                    Select intern...
                  </option>
                  {internOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.fullName}
                    </option>
                  ))}
                </select>
                <svg
                  className="deliverable-form-select-arrow"
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

            <div className="deliverable-form-field">
              <label htmlFor="deliverable-mission" className="deliverable-form-label">
                {t('dashboard.form.mission')}
              </label>
              <div className="deliverable-form-select-wrapper">
                <select
                  id="deliverable-mission"
                  className="deliverable-form-select"
                  value={deliverableForm.missionId}
                  onChange={(e) => onFieldChange('missionId', e.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="" className="deliverable-form-option-placeholder">
                    Select mission...
                  </option>
                  {missionOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title}
                    </option>
                  ))}
                </select>
                <svg
                  className="deliverable-form-select-arrow"
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

            <div className="deliverable-form-field">
              <label htmlFor="deliverable-title" className="deliverable-form-label">
                {t('dashboard.form.title')}
              </label>
              <input
                id="deliverable-title"
                type="text"
                className="deliverable-form-input"
                value={deliverableForm.title}
                onChange={(e) => onFieldChange('title', e.target.value)}
                placeholder="Enter deliverable title..."
                disabled={isSubmitting}
              />
            </div>

            <div className="deliverable-form-field">
              <label htmlFor="deliverable-description" className="deliverable-form-label">
                {t('dashboard.form.description')}
                <span className="deliverable-form-optional">optional</span>
              </label>
              <textarea
                id="deliverable-description"
                className="deliverable-form-textarea"
                value={deliverableForm.description}
                onChange={(e) => onFieldChange('description', e.target.value)}
                placeholder="Add deliverable description..."
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            <div className="deliverable-form-field">
              <label htmlFor="deliverable-dueDate" className="deliverable-form-label">
                {t('dashboard.form.dueDate')}
                <span className="deliverable-form-optional">optional</span>
              </label>
              <input
                id="deliverable-dueDate"
                type="date"
                className="deliverable-form-input"
                value={deliverableForm.dueDate}
                onChange={(e) => onFieldChange('dueDate', e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {hasError && (
              <div className="deliverable-form-error">
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
                <span>{deliverableFormError ?? submitError}</span>
              </div>
            )}
          </div>

          <div className="deliverable-form-footer">
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
              disabled={internOptions.length === 0 || missionOptions.length === 0}
            >
              {t('dashboard.supervisor.deliverables.assign')}
            </DashboardButton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
import { useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { DashboardButton } from '../DashboardButton'
import { Modal } from '../Modal'
import './SupervisorMeetingForm.css'

interface InternOption {
  id: string
  fullName: string
}

interface SupervisorMeetingFormProps {
  internOptions: InternOption[]
  meetingForm: {
    internId: string
    date: string
    note: string
  }
  meetingFormError: string | null
  submitError: string | null
  isSubmitting: boolean
  onFieldChange: (field: 'internId' | 'date' | 'note', value: string) => void
  onSubmit: () => Promise<void>
}

export function SupervisorMeetingForm({
  internOptions,
  meetingForm,
  meetingFormError,
  submitError,
  isSubmitting,
  onFieldChange,
  onSubmit,
}: SupervisorMeetingFormProps) {
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

  const hasError = meetingFormError || submitError

  return (
    <div className="meeting-form-trigger-wrapper">
      <button
        type="button"
        className="meeting-form-trigger"
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
        <span>{t('dashboard.supervisor.meetings.quickAdd')}</span>
      </button>

      {internOptions.length === 0 && (
        <p className="meeting-form-trigger-helper">{t('dashboard.supervisor.meetings.noInterns')}</p>
      )}

      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={t('dashboard.supervisor.meetings.quickAdd')}
      >
        <form className="meeting-form-modal" onSubmit={handleSubmit}>
          <div className="meeting-form-body">
            <div className="meeting-form-field">
              <label htmlFor="meeting-intern" className="meeting-form-label">
                {t('dashboard.form.intern')}
              </label>
              <div className="meeting-form-select-wrapper">
                <select
                  id="meeting-intern"
                  className="meeting-form-select"
                  value={meetingForm.internId}
                  onChange={(e) => onFieldChange('internId', e.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="" className="meeting-form-option-placeholder">
                    Select intern...
                  </option>
                  {internOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.fullName}
                    </option>
                  ))}
                </select>
                <svg
                  className="meeting-form-select-arrow"
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

            <div className="meeting-form-field">
              <label htmlFor="meeting-date" className="meeting-form-label">
                {t('dashboard.form.date')}
              </label>
              <input
                id="meeting-date"
                type="datetime-local"
                className="meeting-form-input"
                value={meetingForm.date}
                onChange={(e) => onFieldChange('date', e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="meeting-form-field">
              <label htmlFor="meeting-note" className="meeting-form-label">
                {t('dashboard.form.note')}
                <span className="meeting-form-optional">optional</span>
              </label>
              <textarea
                id="meeting-note"
                className="meeting-form-textarea"
                value={meetingForm.note}
                onChange={(e) => onFieldChange('note', e.target.value)}
                placeholder="Add meeting notes..."
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            {hasError && (
              <div className="meeting-form-error">
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
                <span>{meetingFormError ?? submitError}</span>
              </div>
            )}
          </div>

          <div className="meeting-form-footer">
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
              {t('dashboard.supervisor.addMeeting')}
            </DashboardButton>
          </div>
        </form>
      </Modal>
    </div>
  )
}

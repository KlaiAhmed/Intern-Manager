import { DashboardButton } from '../DashboardButton'
import { Modal } from '../Modal'
import { useI18n } from '../../../../locales/I18nContext'

interface InternOption {
  id: string
  fullName: string
}

export interface MeetingFormValues {
  internId: string
  date: string
  title: string
  meetingUrl: string
  note: string
}

export const emptyMeetingFormValues: MeetingFormValues = {
  internId: '',
  date: '',
  title: '',
  meetingUrl: '',
  note: '',
}

interface SupervisorMeetingFormProps {
  internOptions: InternOption[]
  meetingForm: MeetingFormValues
  meetingFormError: string | null
  submitError: string | null
  isSubmitting: boolean
  isOpen: boolean
  onOpenChange: (nextOpen: boolean) => void
  onFieldChange: (field: keyof MeetingFormValues, value: string) => void
  onSubmit: () => Promise<void>
}

export function SupervisorMeetingForm({
  internOptions,
  meetingForm,
  meetingFormError,
  submitError,
  isSubmitting,
  isOpen,
  onOpenChange,
  onFieldChange,
  onSubmit,
}: SupervisorMeetingFormProps) {
  const { t } = useI18n()

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    try {
      await onSubmit()
      onOpenChange(false)
    } catch {
      // Error is handled by parent component
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      onOpenChange(false)
    }
  }

  const hasError = meetingFormError || submitError

  const modal = (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t('dashboard.supervisor.drawer.newMeeting')}
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
                onChange={(event) => onFieldChange('internId', event.target.value)}
                disabled={isSubmitting}
                required
              >
                <option value="" className="meeting-form-option-placeholder">
                  {t('dashboard.supervisor.taskDrawer.selectIntern')}
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
              onChange={(event) => onFieldChange('date', event.target.value)}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="meeting-form-field">
            <label htmlFor="meeting-title" className="meeting-form-label">
              {t('dashboard.form.title')}
              <span className="meeting-form-optional">
                {t('dashboard.form.optional')}
              </span>
            </label>
            <input
              id="meeting-title"
              type="text"
              className="meeting-form-input"
              value={meetingForm.title}
              onChange={(event) => onFieldChange('title', event.target.value)}
              placeholder={t('dashboard.supervisor.meetings.titlePlaceholder')}
              maxLength={200}
              disabled={isSubmitting}
            />
          </div>

          <div className="meeting-form-field">
            <label htmlFor="meeting-url" className="meeting-form-label">
              {t('dashboard.supervisor.meetings.url')}
              <span className="meeting-form-optional">
                {t('dashboard.form.optional')}
              </span>
            </label>
            <input
              id="meeting-url"
              type="url"
              className="meeting-form-input"
              value={meetingForm.meetingUrl}
              onChange={(event) => onFieldChange('meetingUrl', event.target.value)}
              placeholder={t('dashboard.supervisor.meetings.urlPlaceholder')}
              maxLength={500}
              disabled={isSubmitting}
            />
          </div>

          <div className="meeting-form-field">
            <label htmlFor="meeting-note" className="meeting-form-label">
              {t('dashboard.form.note')}
              <span className="meeting-form-optional">
                {t('dashboard.form.optional')}
              </span>
            </label>
            <textarea
              id="meeting-note"
              className="meeting-form-textarea"
              value={meetingForm.note}
              onChange={(event) => onFieldChange('note', event.target.value)}
              placeholder={t('dashboard.supervisor.meetings.notePlaceholder')}
              rows={3}
              maxLength={3000}
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
  )

  return <>{modal}</>
}

import { useState, useMemo, type FormEvent, type ChangeEvent } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { CustomSelect, CustomRadio } from '../../../../components/ui'

type WorkPreference = 'remote' | 'hybrid' | 'onsite'
type StudyYear = 'licence' | 'master' | 'doctorat'

interface InternApplicationFormData {
  university: string
  major: string
  currentYear: StudyYear
  expectedGraduation: string
  availableStart: string
  availableEnd: string
  workPreference: WorkPreference
}

interface InternApplicationFormProps {
  internId: string
  onSubmitted: (status: string) => void
}

export function InternApplicationForm({ internId, onSubmitted }: InternApplicationFormProps) {
  const { t } = useI18n()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof InternApplicationFormData, string>>>({})

  const [formData, setFormData] = useState<InternApplicationFormData>({
    university: '',
    major: '',
    currentYear: 'licence',
    expectedGraduation: '',
    availableStart: '',
    availableEnd: '',
    workPreference: 'hybrid',
  })

  // Set min date to today for date fields
  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  // Select options
  const yearOptions = [
    { value: 'licence', label: t('dashboard.intern.application.yearLicence') },
    { value: 'master', label: t('dashboard.intern.application.yearMaster') },
    { value: 'doctorat', label: t('dashboard.intern.application.yearDoctorate') },
  ]

  const workPreferenceOptions = [
    { value: 'remote', label: t('dashboard.intern.application.remote') },
    { value: 'hybrid', label: t('dashboard.intern.application.hybrid') },
    { value: 'onsite', label: t('dashboard.intern.application.onsite') },
  ]

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof InternApplicationFormData, string>> = {}

    if (!formData.university.trim()) {
      newErrors.university = t('dashboard.intern.application.required')
    }
    if (!formData.major.trim()) {
      newErrors.major = t('dashboard.intern.application.required')
    }
    if (!formData.expectedGraduation) {
      newErrors.expectedGraduation = t('dashboard.intern.application.required')
    } else if (formData.expectedGraduation < today) {
      newErrors.expectedGraduation = 'Graduation date cannot be in the past'
    }
    if (!formData.availableStart) {
      newErrors.availableStart = t('dashboard.intern.application.required')
    } else if (formData.availableStart < today) {
      newErrors.availableStart = 'Start date cannot be in the past'
    }
    if (!formData.availableEnd) {
      newErrors.availableEnd = t('dashboard.intern.application.required')
    } else if (formData.availableEnd < today) {
      newErrors.availableEnd = 'End date cannot be in the past'
    }

    // Validate that end date is after start date
    if (formData.availableStart && formData.availableEnd && formData.availableEnd <= formData.availableStart) {
      newErrors.availableEnd = 'End date must be after start date'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    // Clear error when user starts typing
    if (errors[name as keyof InternApplicationFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      // TODO: Replace with actual API call
      // const response = await submitInternApplication(internId, formData)
      // onSubmitted(response.status)

      // Simulated API call for now
      await new Promise((resolve) => setTimeout(resolve, 1500))
      console.log('Submitting application for intern:', internId, formData)
      onSubmitted('PENDING')
    } catch (error) {
      console.error('Failed to submit application:', error)
      setErrors({ university: 'Failed to submit. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="intern-application-container">
      <div className="status-gate-card application-form-card">
        <div className="application-form-header">
          <h1 className="status-gate-title">{t('dashboard.intern.application.title')}</h1>
          <p className="status-gate-subtitle">{t('dashboard.intern.application.subtitle')}</p>
        </div>

        <form className="intern-application-form" onSubmit={handleSubmit}>
          {/* University/Institution */}
          <div className="form-field">
            <label htmlFor="university" className="form-label">
              {t('dashboard.intern.application.university')}
            </label>
            <input
              id="university"
              type="text"
              name="university"
              value={formData.university}
              onChange={handleInputChange}
              disabled={isSubmitting}
              className={`form-input ${errors.university ? 'input-error' : ''}`}
              placeholder="e.g., University of Technology"
            />
            {errors.university && <span className="field-error">{errors.university}</span>}
          </div>

          {/* Major/Field of Study */}
          <div className="form-field">
            <label htmlFor="major" className="form-label">
              {t('dashboard.intern.application.major')}
            </label>
            <input
              id="major"
              type="text"
              name="major"
              value={formData.major}
              onChange={handleInputChange}
              disabled={isSubmitting}
              className={`form-input ${errors.major ? 'input-error' : ''}`}
              placeholder="e.g., Computer Science"
            />
            {errors.major && <span className="field-error">{errors.major}</span>}
          </div>

          {/* Current Year of Study */}
          <div className="form-field">
            <label htmlFor="currentYear" className="form-label">
              {t('dashboard.intern.application.currentYear')}
            </label>
            <CustomSelect
              id="currentYear"
              name="currentYear"
              value={formData.currentYear}
              options={yearOptions}
              onChange={handleInputChange}
              disabled={isSubmitting}
              className={errors.currentYear ? 'input-error' : ''}
            />
          </div>

          {/* Expected Graduation Date */}
          <div className="form-field">
            <label htmlFor="expectedGraduation" className="form-label">
              {t('dashboard.intern.application.expectedGraduation')}
            </label>
            <input
              id="expectedGraduation"
              type="date"
              name="expectedGraduation"
              value={formData.expectedGraduation}
              onChange={handleInputChange}
              disabled={isSubmitting}
              min={today}
              className={`form-input ${errors.expectedGraduation ? 'input-error' : ''}`}
            />
            {errors.expectedGraduation && <span className="field-error">{errors.expectedGraduation}</span>}
          </div>

          {/* Available Start Date */}
          <div className="form-field">
            <label htmlFor="availableStart" className="form-label">
              {t('dashboard.intern.application.availableStart')}
            </label>
            <input
              id="availableStart"
              type="date"
              name="availableStart"
              value={formData.availableStart}
              onChange={handleInputChange}
              disabled={isSubmitting}
              min={today}
              className={`form-input ${errors.availableStart ? 'input-error' : ''}`}
            />
            {errors.availableStart && <span className="field-error">{errors.availableStart}</span>}
          </div>

          {/* Available End Date */}
          <div className="form-field">
            <label htmlFor="availableEnd" className="form-label">
              {t('dashboard.intern.application.availableEnd')}
            </label>
            <input
              id="availableEnd"
              type="date"
              name="availableEnd"
              value={formData.availableEnd}
              onChange={handleInputChange}
              disabled={isSubmitting}
              min={today}
              className={`form-input ${errors.availableEnd ? 'input-error' : ''}`}
            />
            {errors.availableEnd && <span className="field-error">{errors.availableEnd}</span>}
          </div>

          {/* Work Preference */}
          <div className="form-field">
            <label className="form-label">{t('dashboard.intern.application.workPreference')}</label>
            <CustomRadio
              name="workPreference"
              value={formData.workPreference}
              options={workPreferenceOptions}
              onChange={handleInputChange}
              disabled={isSubmitting}
            />
          </div>

          {/* Submit Button */}
          <div className="form-actions">
            <button type="submit" disabled={isSubmitting} className="application-submit-btn">
              {isSubmitting ? t('dashboard.intern.application.submitting') : t('dashboard.intern.application.apply')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

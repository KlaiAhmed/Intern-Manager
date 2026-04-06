import { useState, useMemo, type FormEvent, type ChangeEvent, type DragEvent } from 'react'
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
  cvFile: File | null
}

interface MultiStepApplicationFormProps {
  internId: string
  onSubmitted: (status: string) => void
}

type FormStep = 1 | 2 | 3

export function MultiStepApplicationForm({ internId, onSubmitted }: MultiStepApplicationFormProps) {
  const { t } = useI18n()
  const [currentStep, setCurrentStep] = useState<FormStep>(1)
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
    cvFile: null,
  })

  const [isDragging, setIsDragging] = useState(false)

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

  const validateStep1 = (): boolean => {
    const newErrors: Partial<Record<keyof InternApplicationFormData, string>> = {}

    if (!formData.university.trim()) {
      newErrors.university = t('dashboard.intern.application.required')
    } else if (formData.university.trim().length < 3) {
      newErrors.university = 'University name must be at least 3 characters'
    }
    if (!formData.major.trim()) {
      newErrors.major = t('dashboard.intern.application.required')
    } else if (formData.major.trim().length < 3) {
      newErrors.major = 'Major must be at least 3 characters'
    }
    if (!formData.currentYear) {
      newErrors.currentYear = t('dashboard.intern.application.required')
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

    if (formData.availableStart && formData.availableEnd && formData.availableEnd <= formData.availableStart) {
      newErrors.availableEnd = 'End date must be after start date'
    }
    if (!formData.workPreference) {
      newErrors.workPreference = t('dashboard.intern.application.required')
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const validateStep2 = (): boolean => {
    const newErrors: Partial<Record<keyof InternApplicationFormData, string>> = {}

    if (!formData.cvFile) {
      newErrors.cvFile = 'Please upload your CV'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name as keyof InternApplicationFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData((prev) => ({ ...prev, cvFile: file }))
      if (errors.cvFile) {
        setErrors((prev) => ({ ...prev, cvFile: undefined }))
      }
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file && (file.type === 'application/pdf' || file.type === 'application/msword' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      setFormData((prev) => ({ ...prev, cvFile: file }))
      if (errors.cvFile) {
        setErrors((prev) => ({ ...prev, cvFile: undefined }))
      }
    }
  }

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) {
      setCurrentStep(2)
    } else if (currentStep === 2 && validateStep2()) {
      setCurrentStep(3)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as FormStep)
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (currentStep !== 3) return

    setIsSubmitting(true)

    try {
      // TODO: Replace with actual API call
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
        {/* Step Indicator */}
        <div className="step-indicator">
          {[1, 2, 3].map((step) => (
            <div key={step} className="step-item">
              <div className={`step-circle ${currentStep >= step ? 'active' : ''} ${currentStep > step ? 'completed' : ''}`}>
                {currentStep > step ? '✓' : step}
              </div>
              {step < 3 && <div className={`step-line ${currentStep > step ? 'completed' : ''}`} />}
            </div>
          ))}
        </div>

        <div className="application-form-header">
          <h1 className="status-gate-title">
            {currentStep === 1 && t('dashboard.intern.application.title')}
            {currentStep === 2 && 'Upload Your CV'}
            {currentStep === 3 && 'Application Submitted!'}
          </h1>
          <p className="status-gate-subtitle">
            {currentStep === 1 && t('dashboard.intern.application.subtitle')}
            {currentStep === 2 && 'Please upload your CV/resume to complete your application'}
            {currentStep === 3 && 'Your application is now under review'}
          </p>
        </div>

        <form className="intern-application-form" onSubmit={handleSubmit}>
          {/* Step 1: Application Form */}
          {currentStep === 1 && (
            <>
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
                {errors.currentYear && <span className="field-error">{errors.currentYear}</span>}
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
                {errors.workPreference && <span className="field-error">{errors.workPreference}</span>}
              </div>

              {/* Next Button */}
              <div className="form-actions">
                <button type="button" onClick={handleNext} className="application-submit-btn">
                  Next
                </button>
              </div>
            </>
          )}

          {/* Step 2: Upload CV */}
          {currentStep === 2 && (
            <>
              <div
                className={`cv-upload-zone ${isDragging ? 'dragging' : ''} ${errors.cvFile ? 'error' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  disabled={isSubmitting}
                  className="cv-file-input"
                  id="cv-upload"
                />
                <label htmlFor="cv-upload" className="cv-upload-label">
                  <div className="cv-upload-icon">
                    {formData.cvFile ? '📄' : '📁'}
                  </div>
                  <div className="cv-upload-text">
                    {formData.cvFile ? (
                      <>
                        <strong>{formData.cvFile.name}</strong>
                        <p>Click to replace</p>
                      </>
                    ) : (
                      <>
                        <strong>Drag & drop your CV here</strong>
                        <p>or click to browse (PDF, DOC, DOCX)</p>
                      </>
                    )}
                  </div>
                </label>
              </div>
              {errors.cvFile && <span className="field-error">{errors.cvFile}</span>}

              {/* Navigation Buttons */}
              <div className="form-actions">
                <button type="button" onClick={handleBack} className="button button-secondary">
                  Back
                </button>
                <button type="button" onClick={handleNext} className="application-submit-btn">
                  Next
                </button>
              </div>
            </>
          )}

          {/* Step 3: Confirmation */}
          {currentStep === 3 && (
            <>
              <div className="confirmation-content">
                <div className="confirmation-icon">✓</div>
                <h2 className="confirmation-title">Application Complete!</h2>
                <p className="confirmation-message">
                  Your application has been submitted and is now under review. You will be notified once it's processed.
                </p>

                <div className="submission-summary">
                  <h3>Summary</h3>
                  <div className="summary-item">
                    <strong>University:</strong> {formData.university}
                  </div>
                  <div className="summary-item">
                    <strong>Major:</strong> {formData.major}
                  </div>
                  <div className="summary-item">
                    <strong>Current Year:</strong> {yearOptions.find(y => y.value === formData.currentYear)?.label}
                  </div>
                  <div className="summary-item">
                    <strong>Expected Graduation:</strong> {formData.expectedGraduation}
                  </div>
                  <div className="summary-item">
                    <strong>Availability:</strong> {formData.availableStart} to {formData.availableEnd}
                  </div>
                  <div className="summary-item">
                    <strong>Work Preference:</strong> {workPreferenceOptions.find(w => w.value === formData.workPreference)?.label}
                  </div>
                  <div className="summary-item">
                    <strong>CV:</strong> {formData.cvFile?.name}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="form-actions">
                <button type="button" onClick={handleBack} className="button button-secondary">
                  Back
                </button>
                <button type="submit" disabled={isSubmitting} className="application-submit-btn">
                  {isSubmitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}

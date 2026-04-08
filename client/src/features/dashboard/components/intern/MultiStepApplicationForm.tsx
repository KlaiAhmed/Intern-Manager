import { useState, useEffect, useMemo, type FormEvent, type ChangeEvent, type DragEvent } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { CustomSelect } from '../../../../components/ui'
import { useSchoolsApi, type School } from '../../api/schoolsApi'
import { useDashboardApi } from '../../hooks/useDashboardApi'

type WorkPreference = 'remote' | 'hybrid' | 'onsite'
type StudyYear = 'licence' | 'master' | 'doctorat'

interface InternApplicationFormData {
  universityId: string
  major: string
  currentYearOfStudy: StudyYear
  expectedGraduationDate: string
  startDate: string
  endDate: string
  workPreference: WorkPreference
  cvFile: File | null
}

interface MultiStepApplicationFormProps {
  onSubmitted: (status: string) => void
}

type FormStep = 1 | 2 | 3

export function MultiStepApplicationForm({ onSubmitted }: MultiStepApplicationFormProps) {
  const { t } = useI18n()
  const schoolsApi = useSchoolsApi()
  const api = useDashboardApi()

  const [currentStep, setCurrentStep] = useState<FormStep>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingSchools, setIsLoadingSchools] = useState(true)
  const [schools, setSchools] = useState<School[]>([])
  const [errors, setErrors] = useState<Partial<Record<keyof InternApplicationFormData | string, string>>>({})

  const [formData, setFormData] = useState<InternApplicationFormData>({
    universityId: '',
    major: '',
    currentYearOfStudy: 'licence',
    expectedGraduationDate: '',
    startDate: '',
    endDate: '',
    workPreference: 'hybrid',
    cvFile: null,
  })

  const [isDragging, setIsDragging] = useState(false)

  // Set min date to today for date fields
  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  // Fetch schools on mount
  useEffect(() => {
    const fetchSchools = async () => {
      try {
        setIsLoadingSchools(true)
        const schoolsData = await schoolsApi.getSchools()
        setSchools(schoolsData)
      } catch (error) {
        console.error('Failed to fetch schools:', error)
        setErrors((prev) => ({ ...prev, universityId: 'Failed to load universities' }))
      } finally {
        setIsLoadingSchools(false)
      }
    }

    void fetchSchools()
  }, [])

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

  const schoolOptions = schools.map((school) => ({
    value: school.id,
    label: school.name,
  }))

  const validateStep1 = (): boolean => {
    const newErrors: Partial<Record<keyof InternApplicationFormData, string>> = {}

    if (!formData.universityId.trim()) {
      newErrors.universityId = t('dashboard.intern.application.required')
    }

    if (!formData.major.trim()) {
      newErrors.major = t('dashboard.intern.application.required')
    } else if (formData.major.trim().length < 3) {
      newErrors.major = t('dashboard.intern.application.error.majorMin')
    }

    if (!formData.currentYearOfStudy) {
      newErrors.currentYearOfStudy = t('dashboard.intern.application.required')
    }

    if (!formData.expectedGraduationDate) {
      newErrors.expectedGraduationDate = t('dashboard.intern.application.required')
    } else if (formData.expectedGraduationDate < today) {
      newErrors.expectedGraduationDate = t('dashboard.intern.application.error.graduationPast')
    }

    if (!formData.startDate) {
      newErrors.startDate = t('dashboard.intern.application.required')
    } else if (formData.startDate < today) {
      newErrors.startDate = t('dashboard.intern.application.error.startPast')
    }

    if (!formData.endDate) {
      newErrors.endDate = t('dashboard.intern.application.required')
    } else if (formData.endDate < today) {
      newErrors.endDate = t('dashboard.intern.application.error.endPast')
    }

    if (formData.startDate && formData.endDate && formData.endDate <= formData.startDate) {
      newErrors.endDate = t('dashboard.intern.application.error.endAfterStart')
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
      newErrors.cvFile = t('dashboard.intern.application.step2.required')
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
    if (file) {
      // Validate file type
      if (file.type !== 'application/pdf') {
        setErrors((prev) => ({ ...prev, cvFile: t('dashboard.intern.application.step2.onlyPdf') }))
        return
      }
      // Validate file size (2MB max)
      const maxSize = 2 * 1024 * 1024 // 2MB in bytes
      if (file.size > maxSize) {
        setErrors((prev) => ({ ...prev, cvFile: t('dashboard.intern.application.step2.maxSize') }))
        return
      }
      setFormData((prev) => ({ ...prev, cvFile: file }))
      if (errors.cvFile) {
        setErrors((prev) => ({ ...prev, cvFile: undefined }))
      }
    }
  }

  const handleFileUploadClick = () => {
    document.getElementById('cv-upload-input')?.click()
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

    if (currentStep !== 3 || !formData.cvFile) return

    setIsSubmitting(true)

    try {
      const multipartData = new FormData()
      multipartData.append('universityId', formData.universityId)
      multipartData.append('major', formData.major)
      multipartData.append('currentYearOfStudy', formData.currentYearOfStudy)
      multipartData.append('expectedGraduationDate', formData.expectedGraduationDate)
      multipartData.append('startDate', formData.startDate)
      multipartData.append('endDate', formData.endDate)
      multipartData.append('workPreference', formData.workPreference)
      multipartData.append('cv', formData.cvFile)

      await api.postFormData('/api/interns/me/onboarding', multipartData)

      onSubmitted('PENDING')
    } catch (error) {
      console.error('Failed to submit application:', error)
      setErrors({ universityId: t('dashboard.intern.application.error.submitFailed') })
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
            {currentStep === 2 && t('dashboard.intern.application.step2.title')}
            {currentStep === 3 && t('dashboard.intern.application.step3.title')}
          </h1>
          <p className="status-gate-subtitle">
            {currentStep === 1 && t('dashboard.intern.application.subtitle')}
            {currentStep === 2 && t('dashboard.intern.application.step2.subtitle')}
            {currentStep === 3 && t('dashboard.intern.application.step3.subtitle')}
          </p>
        </div>

        <form className="intern-application-form" onSubmit={handleSubmit}>
          {/* Step 1: Application Form */}
          {currentStep === 1 && (
            <>
              {/* University/Institution */}
              <div className="form-field">
                <label htmlFor="universityId" className="form-label">
                  {t('dashboard.intern.application.university')}
                </label>
                <CustomSelect
                  id="universityId"
                  name="universityId"
                  value={formData.universityId}
                  options={schoolOptions}
                  onChange={handleInputChange}
                  disabled={isSubmitting || isLoadingSchools}
                  className={errors.universityId ? 'input-error' : ''}
                  placeholder={isLoadingSchools ? 'Loading universities...' : 'Select your university'}
                />
                {errors.universityId && <span className="field-error">{errors.universityId}</span>}
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
                  placeholder={t('dashboard.intern.application.placeholder.major')}
                />
                {errors.major && <span className="field-error">{errors.major}</span>}
              </div>

              {/* Current Year of Study */}
              <div className="form-field">
                <label htmlFor="currentYearOfStudy" className="form-label">
                  {t('dashboard.intern.application.currentYear')}
                </label>
                <CustomSelect
                  id="currentYearOfStudy"
                  name="currentYearOfStudy"
                  value={formData.currentYearOfStudy}
                  options={yearOptions}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className={errors.currentYearOfStudy ? 'input-error' : ''}
                />
                {errors.currentYearOfStudy && <span className="field-error">{errors.currentYearOfStudy}</span>}
              </div>

              {/* Expected Graduation Date */}
              <div className="form-field">
                <label htmlFor="expectedGraduationDate" className="form-label">
                  {t('dashboard.intern.application.expectedGraduation')}
                </label>
                <input
                  id="expectedGraduationDate"
                  type="date"
                  name="expectedGraduationDate"
                  value={formData.expectedGraduationDate}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  min={today}
                  className={`form-input ${errors.expectedGraduationDate ? 'input-error' : ''}`}
                />
                {errors.expectedGraduationDate && <span className="field-error">{errors.expectedGraduationDate}</span>}
              </div>

              {/* Available Start Date */}
              <div className="form-field">
                <label htmlFor="startDate" className="form-label">
                  {t('dashboard.intern.application.availableStart')}
                </label>
                <input
                  id="startDate"
                  type="date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  min={today}
                  className={`form-input ${errors.startDate ? 'input-error' : ''}`}
                />
                {errors.startDate && <span className="field-error">{errors.startDate}</span>}
              </div>

              {/* Available End Date */}
              <div className="form-field">
                <label htmlFor="endDate" className="form-label">
                  {t('dashboard.intern.application.availableEnd')}
                </label>
                <input
                  id="endDate"
                  type="date"
                  name="endDate"
                  value={formData.endDate}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  min={today}
                  className={`form-input ${errors.endDate ? 'input-error' : ''}`}
                />
                {errors.endDate && <span className="field-error">{errors.endDate}</span>}
              </div>

              {/* Work Preference */}
              <div className="form-field">
                <label className="form-label">{t('dashboard.intern.application.workPreference')}</label>
                <CustomSelect
                  id="workPreference"
                  name="workPreference"
                  value={formData.workPreference}
                  options={workPreferenceOptions}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className={errors.workPreference ? 'input-error' : ''}
                />
                {errors.workPreference && <span className="field-error">{errors.workPreference}</span>}
              </div>

              <div className="form-actions">
                <button type="button" className="btn-next" onClick={handleNext} disabled={isSubmitting}>
                  {t('dashboard.intern.application.next')}
                </button>
              </div>
            </>
          )}

          {/* Step 2: CV Upload */}
          {currentStep === 2 && (
            <>
              <div
                className={`cv-upload-dropzone ${isDragging ? 'drag-active' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleFileUploadClick}
              >
                <input
                  id="cv-upload-input"
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      if (file.type !== 'application/pdf') {
                        setErrors((prev) => ({ ...prev, cvFile: t('dashboard.intern.application.step2.onlyPdf') }))
                        return
                      }
                      const maxSize = 2 * 1024 * 1024
                      if (file.size > maxSize) {
                        setErrors((prev) => ({ ...prev, cvFile: t('dashboard.intern.application.step2.maxSize') }))
                        return
                      }
                      setFormData((prev) => ({ ...prev, cvFile: file }))
                      if (errors.cvFile) {
                        setErrors((prev) => ({ ...prev, cvFile: undefined }))
                      }
                    }
                  }}
                  disabled={isSubmitting}
                  style={{ display: 'none' }}
                />
                <div className="cv-upload-dropzone-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </div>
                <p className="cv-upload-dropzone-text">{t('dashboard.intern.application.step2.clickOrDrag')}</p>
                <p className="cv-upload-dropzone-hint">{t('dashboard.intern.application.step2.pdfOnly')}</p>
              </div>

              {formData.cvFile && (
                <div className="cv-file-selected">
                  <span className="cv-file-name">{formData.cvFile.name}</span>
                  <button
                    type="button"
                    className="cv-file-remove"
                    onClick={() => setFormData((prev) => ({ ...prev, cvFile: null }))}
                  >
                    ✕
                  </button>
                </div>
              )}

              {errors.cvFile && <span className="field-error">{errors.cvFile}</span>}

              <div className="form-actions">
                <button type="button" className="btn-back" onClick={handleBack} disabled={isSubmitting}>
                  {t('dashboard.intern.application.back')}
                </button>
                <button type="button" className="btn-next" onClick={handleNext} disabled={isSubmitting || !formData.cvFile}>
                  {t('dashboard.intern.application.next')}
                </button>
              </div>
            </>
          )}

          {/* Step 3: Review & Submit */}
          {currentStep === 3 && (
            <>
              <div className="review-section">
                <div className="review-item">
                  <span className="review-label">{t('dashboard.intern.application.university')}</span>
                  <span className="review-value">{schools.find((s) => s.id === formData.universityId)?.name || 'Not selected'}</span>
                </div>
                <div className="review-item">
                  <span className="review-label">{t('dashboard.intern.application.major')}</span>
                  <span className="review-value">{formData.major}</span>
                </div>
                <div className="review-item">
                  <span className="review-label">{t('dashboard.intern.application.currentYear')}</span>
                  <span className="review-value">
                    {yearOptions.find((opt) => opt.value === formData.currentYearOfStudy)?.label}
                  </span>
                </div>
                <div className="review-item">
                  <span className="review-label">{t('dashboard.intern.application.expectedGraduation')}</span>
                  <span className="review-value">{formData.expectedGraduationDate}</span>
                </div>
                <div className="review-item">
                  <span className="review-label">{t('dashboard.intern.application.availableStart')}</span>
                  <span className="review-value">{formData.startDate}</span>
                </div>
                <div className="review-item">
                  <span className="review-label">{t('dashboard.intern.application.availableEnd')}</span>
                  <span className="review-value">{formData.endDate}</span>
                </div>
                <div className="review-item">
                  <span className="review-label">{t('dashboard.intern.application.workPreference')}</span>
                  <span className="review-value">
                    {workPreferenceOptions.find((opt) => opt.value === formData.workPreference)?.label}
                  </span>
                </div>
                <div className="review-item">
                  <span className="review-label">CV</span>
                  <span className="review-value">{formData.cvFile?.name || 'No file selected'}</span>
                </div>
              </div>

              {errors.universityId && <span className="field-error">{errors.universityId}</span>}

              <div className="form-actions">
                <button type="button" className="btn-back" onClick={handleBack} disabled={isSubmitting}>
                  {t('dashboard.intern.application.back')}
                </button>
                <button type="submit" className="btn-submit" disabled={isSubmitting}>
                  {isSubmitting ? t('dashboard.intern.application.submitting') : t('dashboard.intern.application.submit')}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  )
}

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { buildApiUrl } from '../../../../lib/apiClient'
import { uploadInternCvWithProgress } from '../../api/internCvApi'
import { parseCurrentYearOfStudy, getDegreeLevelLabel, getStudyYearLabel } from './academicYear'
import type { InternLifecycleStatus, InternProfileReadOnly } from '../../types/internDashboard'

function extractFileName(fileUrl: string | null | undefined): string | null {
  if (!fileUrl?.trim()) {
    return null
  }

  const cleanedPath = fileUrl.split('?')[0].split('#')[0]
  const fileName = cleanedPath.slice(cleanedPath.lastIndexOf('/') + 1).trim()

  return fileName.length > 0 ? fileName : null
}

function resolveUploadedCvUrl(fileUrl: string | null | undefined): string | null {
  if (!fileUrl?.trim()) {
    return null
  }

  return buildApiUrl('/api/intern/me/profile/cv')
}

export function StatusGateLoading() {
  const { t } = useI18n()

  return (
    <div className="intern-dashboard status-gate-page">
      <div className="status-gate-card">
        <div className="status-gate-spinner" />
        <h1 className="status-gate-title">{t('dashboard.intern.statusGate.loading')}</h1>
      </div>
    </div>
  )
}

function CvUpload({
  internId,
  onUploaded,
}: {
  internId: string
  onUploaded: (status: InternLifecycleStatus) => void
}) {
  const { t } = useI18n()
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateAndUpload = async (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setError(t('dashboard.intern.statusGate.incomplete.onlyPdfAllowed'))
      return false
    }

    setError(null)
    setIsUploading(true)
    setProgress(0)

    try {
      const response = await uploadInternCvWithProgress(internId, file, setProgress)
      onUploaded(response.status ?? 'PENDING')
      return true
    } catch (uploadError) {
      if (uploadError instanceof Error && uploadError.message.trim()) {
        setError(uploadError.message)
      } else {
        setError(t('dashboard.intern.statusGate.incomplete.uploadError'))
      }
      return false
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) {
      return
    }

    await validateAndUpload(file)
    event.target.value = ''
  }

  const handleDragOver = (event: DragEvent) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (event: DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (event: DragEvent) => {
    event.preventDefault()
    setIsDragging(false)

    const file = event.dataTransfer.files?.[0]
    if (!file) {
      return
    }

    await validateAndUpload(file)
  }

  return (
    <div className="cv-upload-card">
      <label
        className={`cv-upload-dropzone ${isDragging ? 'drag-active' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => {
            void handleFileChange(event)
          }}
          disabled={isUploading}
          className="cv-upload-input"
        />
        <div className="cv-upload-dropzone-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p className="cv-upload-dropzone-text">{t('dashboard.intern.statusGate.incomplete.clickOrDrag')}</p>
        <p className="cv-upload-dropzone-hint">{t('dashboard.intern.statusGate.incomplete.pdfOnly')}</p>

        {error && <div className="cv-upload-dropzone-error">{error}</div>}
      </label>

      {isUploading && (
        <div className="cv-upload-progress-wrap">
          <div className="cv-upload-progress-track">
            <div className="cv-upload-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="cv-upload-progress-value">{progress}%</span>
        </div>
      )}
    </div>
  )
}

export function IncompleteStatusView({
  internId,
  onUploaded,
}: {
  internId: string
  onUploaded: (status: InternLifecycleStatus) => void
}) {
  const { t } = useI18n()

  return (
    <div className="intern-dashboard status-gate-page">
      <div className="status-gate-card">
        <div className="status-gate-card-icon" aria-hidden="true">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
        </div>
        <h1 className="status-gate-title">{t('dashboard.intern.statusGate.incomplete.title')}</h1>
        <p className="status-gate-subtitle">
          {t('dashboard.intern.statusGate.incomplete.subtitle')}
        </p>
        <CvUpload internId={internId} onUploaded={onUploaded} />
      </div>
    </div>
  )
}

export function PendingStatusView({
  notificationMessage,
  profile,
}: {
  notificationMessage: string
  profile: InternProfileReadOnly | null
}) {
  const { t } = useI18n()
  const [showProfile, setShowProfile] = useState(true)

  const formatWorkPreference = (value: string | null | undefined) => {
    const normalizedValue = value?.trim().toLowerCase()

    if (!normalizedValue) {
      return null
    }

    switch (normalizedValue) {
      case 'remote':
        return t('dashboard.intern.application.remote')
      case 'hybrid':
        return t('dashboard.intern.application.hybrid')
      case 'onsite':
        return t('dashboard.intern.application.onsite')
      default:
        return value?.trim() ?? null
    }
  }

  const universityValue = profile?.universityName?.trim() || profile?.universityId?.trim() || null
  const majorValue = profile?.major?.trim() || null
  const phoneNumberValue = profile?.phoneNumber?.trim() || null
  const parsedStudyInfo = parseCurrentYearOfStudy(profile?.currentYearOfStudy)
  const degreeLevelValue = parsedStudyInfo ? getDegreeLevelLabel(parsedStudyInfo.degreeLevel, t) : null
  const studyYearValue = parsedStudyInfo?.studyYear ? getStudyYearLabel(parsedStudyInfo.studyYear, t) : null
  const workPreferenceValue = formatWorkPreference(profile?.workPreference)
  const cvFileName = extractFileName(profile?.cvFileUrl)
  const cvFileUrl = resolveUploadedCvUrl(profile?.cvFileUrl)

  return (
    <div className="intern-dashboard status-gate-page">
      <div className="status-gate-card pending-status-card">
        <div className="pending-status-header">
          <div className="pending-indicator" aria-hidden="true" />
          <h1 className="status-gate-title">{t('dashboard.intern.statusGate.pending.title')}</h1>
        </div>
        <p className="status-gate-subtitle">
          {t('dashboard.intern.statusGate.pending.subtitle')}
        </p>
        <p className="pending-notification-message">{notificationMessage}</p>

        <div className="pending-actions">
          <button
            type="button"
            className="pending-btn pending-btn-primary"
            aria-expanded={showProfile}
            aria-controls="pending-profile-panel"
            onClick={() => setShowProfile((currentValue) => !currentValue)}
          >
            {showProfile ? t('dashboard.intern.statusGate.pending.hideProfile') : t('dashboard.intern.statusGate.pending.viewProfile')}
          </button>
        </div>

        {showProfile && (
          <div className="pending-profile-panel" id="pending-profile-panel" aria-live="polite">
            <div className="pending-profile-panel-grid">
              <div className="pending-profile-row">
                <span className="pending-profile-label">{t('dashboard.intern.application.university')}</span>
                <div className="pending-profile-value">
                  {universityValue ? (
                    <span>{universityValue}</span>
                  ) : (
                    <span className="pending-profile-value-empty">{t('dashboard.intern.statusGate.pending.notProvided')}</span>
                  )}
                </div>
              </div>
              <div className="pending-profile-row">
                <span className="pending-profile-label">{t('dashboard.intern.application.major')}</span>
                <div className="pending-profile-value">
                  {majorValue ? (
                    <span>{majorValue}</span>
                  ) : (
                    <span className="pending-profile-value-empty">{t('dashboard.intern.statusGate.pending.notProvided')}</span>
                  )}
                </div>
              </div>
              <div className="pending-profile-row">
                <span className="pending-profile-label">{t('dashboard.intern.statusGate.pending.phone')}</span>
                <div className="pending-profile-value">
                  {phoneNumberValue ? (
                    <span>{phoneNumberValue}</span>
                  ) : (
                    <span className="pending-profile-value-empty">{t('dashboard.intern.statusGate.pending.notProvided')}</span>
                  )}
                </div>
              </div>
              <div className="pending-profile-row">
                <span className="pending-profile-label">{t('dashboard.intern.application.degreeLevel')}</span>
                <div className="pending-profile-value">
                  {degreeLevelValue ? (
                    <span>{degreeLevelValue}</span>
                  ) : (
                    <span className="pending-profile-value-empty">{t('dashboard.intern.statusGate.pending.notProvided')}</span>
                  )}
                </div>
              </div>
              {studyYearValue && (
                <div className="pending-profile-row">
                  <span className="pending-profile-label">{t('dashboard.intern.application.studyYear')}</span>
                  <div className="pending-profile-value">
                    <span>{studyYearValue}</span>
                  </div>
                </div>
              )}
              <div className="pending-profile-row">
                <span className="pending-profile-label">{t('dashboard.intern.application.workPreference')}</span>
                <div className="pending-profile-value">
                  {workPreferenceValue ? (
                    <span>{workPreferenceValue}</span>
                  ) : (
                    <span className="pending-profile-value-empty">{t('dashboard.intern.statusGate.pending.notProvided')}</span>
                  )}
                </div>
              </div>
              <div className="pending-profile-row">
                <span className="pending-profile-label">{t('dashboard.intern.statusGate.pending.cvFile')}</span>
                <div className="pending-profile-value">
                  {cvFileUrl ? (
                    <a
                      className="pending-cv-link"
                      href={cvFileUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      title={cvFileName ?? undefined}
                      aria-label={t('dashboard.intern.statusGate.pending.viewCv')}
                    >
                      {t('dashboard.intern.statusGate.pending.viewCv')}
                    </a>
                  ) : (
                    <span className="pending-profile-value-empty">{t('dashboard.intern.statusGate.pending.notUploaded')}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

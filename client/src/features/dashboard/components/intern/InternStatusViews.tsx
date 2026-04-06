import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { uploadInternCvWithProgress } from '../../api/internCvApi'
import type { InternLifecycleStatus, InternProfileReadOnly } from '../../types/internDashboard'

export function StatusGateLoading() {
  return (
    <div className="intern-dashboard status-gate-page">
      <div className="status-gate-card">
        <div className="status-gate-spinner" />
        <h1 className="status-gate-title">Loading your internship status...</h1>
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
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateAndUpload = async (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (!isPdf) {
      setError('Only PDF files are allowed.')
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
        setError('Unable to upload CV right now.')
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
        <p className="cv-upload-dropzone-text">Click or drag and drop your CV</p>
        <p className="cv-upload-dropzone-hint">PDF files only, up to 10MB</p>

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
        <h1 className="status-gate-title">Complete your profile</h1>
        <p className="status-gate-subtitle">
          Upload your CV to move your profile to supervisor review
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
  const [showProfile, setShowProfile] = useState(false)

  return (
    <div className="intern-dashboard status-gate-page">
      <div className="status-gate-card pending-status-card">
        <div className="pending-status-header">
          <div className="pending-indicator" aria-hidden="true" />
          <h1 className="status-gate-title">Under review</h1>
        </div>
        <p className="status-gate-subtitle">
          Your CV has been submitted and is being reviewed by our team
        </p>
        <p className="pending-notification-message">{notificationMessage}</p>

        <div className="pending-actions">
          <button
            type="button"
            className="pending-btn pending-btn-primary"
            onClick={() => setShowProfile((currentValue) => !currentValue)}
          >
            {showProfile ? 'Hide profile' : 'View my profile'}
          </button>
        </div>

        {showProfile && (
          <div className="pending-profile-panel" aria-live="polite">
            <div className="pending-profile-panel-grid">
              <div className="pending-profile-row">
                <span className="pending-profile-label">School</span>
                <span className="pending-profile-value">
                  {profile?.school || <span className="pending-profile-value-empty">Not provided</span>}
                </span>
              </div>
              <div className="pending-profile-row">
                <span className="pending-profile-label">Specialty</span>
                <span className="pending-profile-value">
                  {profile?.specialty || <span className="pending-profile-value-empty">Not provided</span>}
                </span>
              </div>
              <div className="pending-profile-row">
                <span className="pending-profile-label">Experience</span>
                <span className="pending-profile-value">
                  {profile?.experience || <span className="pending-profile-value-empty">Not provided</span>}
                </span>
              </div>
              <div className="pending-profile-row">
                <span className="pending-profile-label">CV File</span>
                <span className="pending-profile-value">
                  {profile?.cvFileUrl ? (
                    <a href={profile.cvFileUrl} target="_blank" rel="noreferrer">View uploaded CV</a>
                  ) : (
                    <span className="pending-profile-value-empty">Not uploaded</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

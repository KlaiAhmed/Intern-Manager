import type { Internship, TranslateFn } from '../../../types/internDashboard'
import { CircularProgress, Icons } from './Icons'

interface MissionCardProps {
  internship: Internship | null
  loading: boolean
  error: string | null
  onRetry: () => void
  t: TranslateFn
}

export function MissionCard({
  internship,
  loading,
  error,
  onRetry,
  t,
}: MissionCardProps) {
  if (loading) {
    return (
      <div className="intern-card mission-card">
        <div className="skeleton-title" />
        <div className="mission-loading-layout">
          <div className="skeleton-circle" />
          <div className="mission-loading-content">
            <div className="skeleton-line skeleton-line-w-80" />
            <div className="skeleton-line skeleton-line-w-60" />
            <div className="skeleton-line skeleton-line-w-40" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="intern-card mission-card">
        <div className="error-state-modern">
          <div className="error-state-icon">⚠️</div>
          <p className="error-state-text">{error}</p>
          <button className="error-retry-btn" onClick={onRetry}>Retry</button>
        </div>
      </div>
    )
  }

  if (!internship) {
    return (
      <div className="intern-card mission-card">
        <div className="empty-state-modern">
          <div className="empty-state-icon">📝</div>
          <p className="empty-state-text">{t('dashboard.noData')}</p>
        </div>
      </div>
    )
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const getStatusClass = () => {
    switch (internship.status.toLowerCase()) {
      case 'active': return 'mission-status-active'
      case 'pending': return 'mission-status-pending'
      case 'completed': return 'mission-status-completed'
      default: return 'mission-status-active'
    }
  }

  return (
    <div className="intern-card mission-card">
      <div className="mission-card-header">
        <div>
          <h2 className="mission-title">{internship.missionTitle}</h2>
          <div className="mission-meta">
            <div className="mission-meta-item">
              <span className="mission-meta-icon"><Icons.user /></span>
              {internship.supervisorName}
            </div>
            <div className="mission-meta-item">
              <span className="mission-meta-icon"><Icons.building /></span>
              {internship.department}
            </div>
          </div>
        </div>
        <span className={`mission-status-badge ${getStatusClass()}`}>{internship.status}</span>
      </div>
      <div className="mission-progress-container">
        <CircularProgress value={internship.progress} />
        <div className="mission-progress-details">
          <div className="progress-bar-wrapper">
            <div className="progress-bar-label-row">
              <span className="progress-bar-label">{t('dashboard.intern.progress')}</span>
              <span className="progress-bar-value">{internship.progress}%</span>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: `${internship.progress}%` }} />
            </div>
          </div>
          <div className="mission-dates">
            <div className="mission-date-item">
              <span className="mission-date-label">Start Date</span>
              <span className="mission-date-value">{formatDate(internship.startDate)}</span>
            </div>
            <div className="mission-date-item">
              <span className="mission-date-label">End Date</span>
              <span className="mission-date-value">{formatDate(internship.endDate)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

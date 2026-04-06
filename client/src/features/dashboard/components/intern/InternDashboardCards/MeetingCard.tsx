import type { Meeting } from '../../../types/internDashboard'
import { Icons } from './Icons'

interface MeetingCardProps {
  meeting: Meeting | null
  loading: boolean
  error: string | null
  onRetry: () => void
}

export function MeetingCard({
  meeting,
  loading,
  error,
  onRetry,
}: MeetingCardProps) {
  if (loading) {
    return (
      <div className="intern-card meeting-card">
        <div className="card-title">👥 Next Meeting</div>
        <div className="skeleton-card skeleton-card-lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="intern-card meeting-card">
        <div className="error-state-modern">
          <div className="error-state-icon">⚠️</div>
          <p className="error-state-text">{error}</p>
          <button className="error-retry-btn" onClick={onRetry}>Retry</button>
        </div>
      </div>
    )
  }

  if (!meeting) {
    return (
      <div className="intern-card meeting-card">
        <div className="card-header">
          <h2 className="card-title"><span className="card-title-icon">👥</span> Next Meeting</h2>
        </div>
        <div className="empty-state-modern">
          <div className="empty-state-icon">📅</div>
          <p className="empty-state-text">No upcoming meetings</p>
        </div>
      </div>
    )
  }

  const meetingDate = new Date(meeting.date)
  const month = meetingDate.toLocaleString('default', { month: 'short' })
  const day = meetingDate.getDate()
  const time = meetingDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="intern-card meeting-card">
      <div className="card-header">
        <h2 className="card-title"><span className="card-title-icon">👥</span> Next Meeting</h2>
      </div>
      <div className="meeting-display">
        <div className="meeting-calendar">
          <span className="meeting-calendar-month">{month}</span>
          <span className="meeting-calendar-day">{day}</span>
        </div>
        <div className="meeting-details">
          <span className="meeting-with">Meeting with</span>
          <span className="meeting-supervisor-name">{meeting.supervisorName}</span>
          <div className="meeting-time">
            <Icons.clock />
            {time}
          </div>
          {meeting.notes && <p className="meeting-notes-preview">&ldquo;{meeting.notes.slice(0, 80)}...&rdquo;</p>}
        </div>
      </div>
    </div>
  )
}

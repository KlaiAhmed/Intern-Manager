import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { useAuth } from '../../../shared/state/AuthContext'
import { Modal } from '../components/Modal'
import { useDashboardApi } from '../hooks/useDashboardApi'
import './InternDashboard.css'

type TranslateFn = ReturnType<typeof useI18n>['t']

interface Internship {
  id: string
  missionTitle: string
  supervisorName: string
  department: string
  startDate: string
  endDate: string
  status: string
  progress: number
}

interface Task {
  id: string
  title: string
  dueDate: string
  completed: boolean
  priority?: 'high' | 'medium' | 'low'
}

interface Deliverable {
  id: string
  title: string
  dueDate: string
  status: 'not_submitted' | 'submitted' | 'accepted' | 'rejected'
  version: number
  supervisorComment?: string
  progress: number
}

interface JournalEntry {
  id: string
  content: string
  createdAt: string
}

interface Evaluation {
  id: string
  type: 'mid_term' | 'end_of_internship'
  scores: {
    technical: number
    autonomy: number
    communication: number
    deadlineRespect: number
    deliverableQuality: number
  }
  comments: string
  date: string
}

interface Meeting {
  id: string
  date: string
  supervisorName: string
  notes: string
}

// Icons as simple SVG components
const Icons = {
  user: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '1.25rem', height: '1.25rem' }}>
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </svg>
  ),
  building: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '1.25rem', height: '1.25rem' }}>
      <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10z"/>
    </svg>
  ),
  upload: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '1rem', height: '1rem' }}>
      <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
    </svg>
  ),
  comment: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '1rem', height: '1rem' }}>
      <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/>
    </svg>
  ),
  close: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '1.5rem', height: '1.5rem' }}>
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
    </svg>
  ),
  clock: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '1rem', height: '1rem' }}>
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
    </svg>
  ),
}

// Circular Progress Component
function CircularProgress({ value, size = 128 }: { value: number; size?: number }) {
  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (value / 100) * circumference

  return (
    <div className="progress-ring-wrapper" style={{ width: size, height: size }}>
      <svg className="progress-ring-svg" viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <circle className="progress-ring-bg" cx={size / 2} cy={size / 2} r={radius} />
        <circle
          className="progress-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          style={{ strokeDasharray: circumference, strokeDashoffset }}
        />
      </svg>
      <div className="progress-ring-value">{value}%</div>
      <div className="progress-ring-label">Complete</div>
    </div>
  )
}

// Mission Card Component
function MissionCard({ internship, loading, error, onRetry, t }: {
  internship: Internship | null
  loading: boolean
  error: string | null
  onRetry: () => void
  t: TranslateFn
}) {
  if (loading) {
    return (
      <div className="intern-card mission-card">
        <div className="skeleton-title" />
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
          <div className="skeleton-circle" />
          <div style={{ flex: 1 }}>
            <div className="skeleton-line" style={{ width: '80%' }} />
            <div className="skeleton-line" style={{ width: '60%' }} />
            <div className="skeleton-line" style={{ width: '40%' }} />
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

// Quick Stats Card
function QuickStatsCard({ tasks, deliverables, internship, meetingsCount, loading }: {
  tasks: Task[]
  deliverables: Deliverable[]
  internship: Internship | null
  meetingsCount: number
  loading: boolean
}) {
  const completedTasks = tasks.filter(t => t.completed).length
  const submittedDeliverables = deliverables.filter(d => d.status !== 'not_submitted').length
  const daysLeft = internship ? Math.ceil((new Date(internship.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0

  if (loading) {
    return (
      <div className="intern-card stats-card">
        <div className="stats-card-title">Overview</div>
        <div className="stats-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="skeleton-card" style={{ padding: '1rem', height: '5rem' }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="intern-card stats-card">
      <h2 className="stats-card-title">Overview</h2>
      <div className="stats-grid">
        <div className="stat-bubble">
          <div className="stat-bubble-icon stat-bubble-icon-tasks">📋</div>
          <div className="stat-bubble-value">{completedTasks}/{tasks.length}</div>
          <div className="stat-bubble-label">Tasks Done</div>
        </div>
        <div className="stat-bubble">
          <div className="stat-bubble-icon stat-bubble-icon-deliverables">📁</div>
          <div className="stat-bubble-value">{submittedDeliverables}/{deliverables.length}</div>
          <div className="stat-bubble-label">Files</div>
        </div>
        <div className="stat-bubble">
          <div className="stat-bubble-icon stat-bubble-icon-days">📅</div>
          <div className="stat-bubble-value">{Math.max(0, daysLeft)}</div>
          <div className="stat-bubble-label">Days Left</div>
        </div>
        <div className="stat-bubble">
          <div className="stat-bubble-icon stat-bubble-icon-meetings">👥</div>
          <div className="stat-bubble-value">{meetingsCount}</div>
          <div className="stat-bubble-label">Meetings</div>
        </div>
      </div>
    </div>
  )
}

// Tasks Card
function TasksCard({ tasks, loading, error, onRetry, onComplete }: {
  tasks: Task[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onComplete: (id: string) => void
}) {
  const incompleteTasks = tasks.filter(t => !t.completed).slice(0, 4)

  if (loading) {
    return (
      <div className="intern-card tasks-card">
        <div className="card-title">Tasks</div>
        <div className="task-list-modern">
          {[1, 2, 3].map(i => <div key={i} className="skeleton-card" style={{ height: '3rem' }} />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="intern-card tasks-card">
        <div className="error-state-modern">
          <div className="error-state-icon">⚠️</div>
          <p className="error-state-text">{error}</p>
          <button className="error-retry-btn" onClick={onRetry}>Retry</button>
        </div>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="intern-card tasks-card">
        <div className="card-header">
          <h2 className="card-title"><span className="card-title-icon">📋</span> Tasks</h2>
        </div>
        <div className="empty-state-modern">
          <div className="empty-state-icon">✅</div>
          <p className="empty-state-text">No tasks assigned</p>
        </div>
      </div>
    )
  }

  return (
    <div className="intern-card tasks-card">
      <div className="card-header">
        <h2 className="card-title"><span className="card-title-icon">📋</span> Tasks</h2>
        <span className="card-action">{tasks.filter(t => t.completed).length}/{tasks.length}</span>
      </div>
      <div className="task-list-modern">
        {incompleteTasks.map(task => (
          <div key={task.id} className={`task-item-modern ${task.completed ? 'completed' : ''}`}>
            <input
              type="checkbox"
              checked={task.completed}
              onChange={() => !task.completed && onComplete(task.id)}
              disabled={task.completed}
              className="task-checkbox-modern"
            />
            <div className="task-content-modern">
              <p className="task-title-modern">{task.title}</p>
              <p className="task-due-modern">Due {task.dueDate}</p>
            </div>
            <div className={`task-priority task-priority-${task.priority || 'low'}`} />
          </div>
        ))}
      </div>
    </div>
  )
}

// Deliverables Card
function DeliverablesCard({ deliverables, loading, error, onRetry, onUploadClick, onViewComment }: {
  deliverables: Deliverable[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onUploadClick: (id: string) => void
  onViewComment: (d: Deliverable) => void
}) {
  const getStatusClass = (status: Deliverable['status']) => {
    switch (status) {
      case 'submitted': return 'deliverable-status-submitted'
      case 'accepted': return 'deliverable-status-accepted'
      case 'rejected': return 'deliverable-status-rejected'
      default: return 'deliverable-status-pending'
    }
  }

  const getStatusLabel = (status: Deliverable['status']) => {
    switch (status) {
      case 'submitted': return 'Submitted'
      case 'accepted': return 'Accepted'
      case 'rejected': return 'Rejected'
      default: return 'Pending'
    }
  }

  const getProgressClass = (status: Deliverable['status']) => {
    switch (status) {
      case 'submitted': return 'deliverable-progress-fill-submitted'
      case 'accepted': return 'deliverable-progress-fill-accepted'
      case 'rejected': return 'deliverable-progress-fill-rejected'
      default: return 'deliverable-progress-fill-pending'
    }
  }

  if (loading) {
    return (
      <div className="intern-card deliverables-card">
        <div className="card-title">📁 Deliverables</div>
        <div className="deliverable-list">
          {[1, 2].map(i => <div key={i} className="skeleton-card" style={{ height: '6rem' }} />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="intern-card deliverables-card">
        <div className="error-state-modern">
          <div className="error-state-icon">⚠️</div>
          <p className="error-state-text">{error}</p>
          <button className="error-retry-btn" onClick={onRetry}>Retry</button>
        </div>
      </div>
    )
  }

  if (deliverables.length === 0) {
    return (
      <div className="intern-card deliverables-card">
        <div className="card-header">
          <h2 className="card-title"><span className="card-title-icon">📁</span> Deliverables</h2>
        </div>
        <div className="empty-state-modern">
          <div className="empty-state-icon">📂</div>
          <p className="empty-state-text">No deliverables</p>
        </div>
      </div>
    )
  }

  return (
    <div className="intern-card deliverables-card">
      <div className="card-header">
        <h2 className="card-title"><span className="card-title-icon">📁</span> Deliverables</h2>
        <span className="card-action">{deliverables.filter(d => d.status === 'accepted').length}/{deliverables.length}</span>
      </div>
      <div className="deliverable-list">
        {deliverables.slice(0, 3).map(deliverable => (
          <div key={deliverable.id} className="deliverable-item">
            <div className="deliverable-header-row">
              <div className="deliverable-title-row">
                <div className="deliverable-icon">📄</div>
                <span className="deliverable-name">{deliverable.title}</span>
              </div>
              <span className={`deliverable-status ${getStatusClass(deliverable.status)}`}>
                {getStatusLabel(deliverable.status)}
                {deliverable.status === 'submitted' && ` v${deliverable.version}`}
              </span>
            </div>
            <div className="deliverable-progress-mini">
              <div className="deliverable-progress-track">
                <div className={`deliverable-progress-fill ${getProgressClass(deliverable.status)}`} style={{ width: `${deliverable.progress}%` }} />
              </div>
              <span className="deliverable-progress-value">{deliverable.progress}%</span>
            </div>
            <div className="deliverable-actions-row">
              <button className="deliverable-btn deliverable-btn-primary" onClick={() => onUploadClick(deliverable.id)}>
                <Icons.upload /> Upload
              </button>
              {deliverable.status === 'rejected' && deliverable.supervisorComment && (
                <button className="deliverable-btn" onClick={() => onViewComment(deliverable)}>
                  <Icons.comment /> View
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Evaluation Card
function EvaluationCard({ evaluations, loading, error, onRetry, t }: {
  evaluations: Evaluation[]
  loading: boolean
  error: string | null
  onRetry: () => void
  t: TranslateFn
}) {
  const getScoreClass = (score: number) => {
    if (score >= 8) return 'score-pill-excellent'
    if (score >= 6) return 'score-pill-good'
    return 'score-pill-average'
  }

  const getOverallScore = (scores: Evaluation['scores']) => {
    const values = Object.values(scores)
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
  }

  if (loading) {
    return (
      <div className="intern-card evaluation-card">
        <div className="card-title">📊 Evaluations</div>
        <div className="skeleton-card" style={{ height: '8rem' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="intern-card evaluation-card">
        <div className="error-state-modern">
          <div className="error-state-icon">⚠️</div>
          <p className="error-state-text">{error}</p>
          <button className="error-retry-btn" onClick={onRetry}>Retry</button>
        </div>
      </div>
    )
  }

  if (evaluations.length === 0) {
    return (
      <div className="intern-card evaluation-card">
        <div className="card-header">
          <h2 className="card-title"><span className="card-title-icon">📊</span> Evaluations</h2>
        </div>
        <div className="empty-state-modern">
          <div className="empty-state-icon">📋</div>
          <p className="empty-state-text">No evaluations yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className="intern-card evaluation-card">
      <div className="card-header">
        <h2 className="card-title"><span className="card-title-icon">📊</span> {t('dashboard.intern.myEvaluations')}</h2>
      </div>
      <div className="evaluation-list">
        {evaluations.slice(-1).map(evaluation => (
          <div key={evaluation.id} className="evaluation-item">
            <div className="evaluation-header">
              <h3 className="evaluation-type">{evaluation.type === 'mid_term' ? 'Midterm' : 'Final'}</h3>
              <span className="evaluation-date">{evaluation.date}</span>
            </div>
            <div className="evaluation-scores-grid">
              <div className={`score-pill ${getScoreClass(evaluation.scores.technical)}`}>
                <span className="score-pill-value">{evaluation.scores.technical}</span>
                <span className="score-pill-label">Tech</span>
              </div>
              <div className={`score-pill ${getScoreClass(evaluation.scores.autonomy)}`}>
                <span className="score-pill-value">{evaluation.scores.autonomy}</span>
                <span className="score-pill-label">Auto</span>
              </div>
              <div className={`score-pill ${getScoreClass(evaluation.scores.communication)}`}>
                <span className="score-pill-value">{evaluation.scores.communication}</span>
                <span className="score-pill-label">Comm</span>
              </div>
              <div className={`score-pill ${getScoreClass(evaluation.scores.deadlineRespect)}`}>
                <span className="score-pill-value">{evaluation.scores.deadlineRespect}</span>
                <span className="score-pill-label">Time</span>
              </div>
              <div className={`score-pill ${getScoreClass(evaluation.scores.deliverableQuality)}`}>
                <span className="score-pill-value">{evaluation.scores.deliverableQuality}</span>
                <span className="score-pill-label">Quality</span>
              </div>
            </div>
            <div className="overall-score">
              <span className="overall-score-label">Overall:</span>
              <span className="overall-score-value">{getOverallScore(evaluation.scores)}/10</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Journal Card
function JournalCard({ entries, loading, error, onRetry, onAddClick }: {
  entries: JournalEntry[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onAddClick: () => void
}) {
  if (loading) {
    return (
      <div className="intern-card journal-card">
        <div className="card-title">📝 Journal</div>
        <div className="journal-entries-list">
          {[1, 2].map(i => <div key={i} className="skeleton-card" style={{ height: '4rem' }} />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="intern-card journal-card">
        <div className="error-state-modern">
          <div className="error-state-icon">⚠️</div>
          <p className="error-state-text">{error}</p>
          <button className="error-retry-btn" onClick={onRetry}>Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="intern-card journal-card">
      <div className="card-header">
        <h2 className="card-title"><span className="card-title-icon">📝</span> Journal</h2>
        <span className="card-action">{entries.length} entries</span>
      </div>
      {entries.length === 0 ? (
        <div className="empty-state-modern">
          <div className="empty-state-icon">📝</div>
          <p className="empty-state-text">No journal entries</p>
          <button className="deliverable-btn deliverable-btn-primary" onClick={onAddClick} style={{ marginTop: '1rem' }}>
            + Add Entry
          </button>
        </div>
      ) : (
        <div className="journal-entries-list">
          {entries.slice(0, 2).map(entry => (
            <div key={entry.id} className="journal-entry-modern">
              <p className="journal-entry-content">{entry.content}</p>
              <span className="journal-entry-date">{entry.createdAt}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Meeting Card
function MeetingCard({ meeting, loading, error, onRetry }: {
  meeting: Meeting | null
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  if (loading) {
    return (
      <div className="intern-card meeting-card">
        <div className="card-title">👥 Next Meeting</div>
        <div className="skeleton-card" style={{ height: '6rem' }} />
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

// Main Dashboard Component
export function InternDashboard() {
  const { t } = useI18n()
  const { user } = useAuth()
  const api = useDashboardApi()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Data states
  const [internship, setInternship] = useState<Internship | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [nextMeeting, setNextMeeting] = useState<Meeting | null>(null)
  const [meetingsCount, setMeetingsCount] = useState(0)

  // Modal states
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false)
  const [journalContent, setJournalContent] = useState('')
  const [selectedDeliverableForUpload, setSelectedDeliverableForUpload] = useState<string | null>(null)
  const [commentModalDeliverable, setCommentModalDeliverable] = useState<Deliverable | null>(null)

  // Loading states
  const [loadingInternship, setLoadingInternship] = useState(true)
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [loadingDeliverables, setLoadingDeliverables] = useState(true)
  const [loadingJournal, setLoadingJournal] = useState(true)
  const [loadingEvaluations, setLoadingEvaluations] = useState(true)
  const [loadingMeeting, setLoadingMeeting] = useState(true)
  const [loadingMeetingsCount, setLoadingMeetingsCount] = useState(true)

  // Error states
  const [internshipError, setInternshipError] = useState<string | null>(null)
  const [tasksError, setTasksError] = useState<string | null>(null)
  const [deliverablesError, setDeliverablesError] = useState<string | null>(null)
  const [journalError, setJournalError] = useState<string | null>(null)
  const [evaluationsError, setEvaluationsError] = useState<string | null>(null)
  const [meetingError, setMeetingError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message.trim()) {
      return error.message
    }
    return t('dashboard.error.load')
  }

  const emptyEvaluationScores: Evaluation['scores'] = {
    technical: 0,
    autonomy: 0,
    communication: 0,
    deadlineRespect: 0,
    deliverableQuality: 0,
  }

  const loadInternship = async () => {
    setLoadingInternship(true)
    setInternshipError(null)
    try {
      const result = await api.get<Internship>('/api/intern/me/internship')
      setInternship(result)
    } catch (error) {
      setInternshipError(getErrorMessage(error))
    } finally {
      setLoadingInternship(false)
    }
  }

  const loadTasks = async () => {
    setLoadingTasks(true)
    setTasksError(null)
    try {
      const result = await api.get<{ data: Task[] }>('/api/intern/me/tasks')
      setTasks(result.data ?? [])
    } catch (error) {
      setTasksError(getErrorMessage(error))
    } finally {
      setLoadingTasks(false)
    }
  }

  const loadDeliverables = async () => {
    setLoadingDeliverables(true)
    setDeliverablesError(null)
    try {
      const result = await api.get<{ data: Deliverable[] }>('/api/intern/me/deliverables')
      setDeliverables(result.data ?? [])
    } catch (error) {
      setDeliverablesError(getErrorMessage(error))
    } finally {
      setLoadingDeliverables(false)
    }
  }

  const loadJournal = async () => {
    setLoadingJournal(true)
    setJournalError(null)
    try {
      const result = await api.get<{ data: JournalEntry[] }>('/api/intern/me/journal?limit=5')
      setJournalEntries(result.data ?? [])
    } catch (error) {
      setJournalError(getErrorMessage(error))
    } finally {
      setLoadingJournal(false)
    }
  }

  const loadEvaluations = async () => {
    setLoadingEvaluations(true)
    setEvaluationsError(null)
    try {
      const result = await api.get<{
        data: Array<{
          id: string
          type: Evaluation['type']
          scores?: Evaluation['scores']
          criteria?: Evaluation['scores']
          comments: string
          date?: string
          submittedAt?: string
        }>
      }>('/api/intern/me/evaluations')

      const normalizedEvaluations: Evaluation[] = (result.data ?? []).map((evaluation) => ({
        id: evaluation.id,
        type: evaluation.type,
        scores: evaluation.scores ?? evaluation.criteria ?? emptyEvaluationScores,
        comments: evaluation.comments,
        date: evaluation.date ?? evaluation.submittedAt ?? '',
      }))

      setEvaluations(normalizedEvaluations)
    } catch (error) {
      setEvaluationsError(getErrorMessage(error))
    } finally {
      setLoadingEvaluations(false)
    }
  }

  const loadMeetingsCount = async () => {
    setLoadingMeetingsCount(true)
    try {
      const result = await api.get<{ count?: number }>('/api/meetings?internId=me&upcoming=true&count=true')
      setMeetingsCount(typeof result.count === 'number' ? result.count : 0)
    } catch {
      setMeetingsCount(0)
    } finally {
      setLoadingMeetingsCount(false)
    }
  }

  const loadNextMeeting = async () => {
    setLoadingMeeting(true)
    setMeetingError(null)
    try {
      const result = await api.get<{ data?: Meeting[] }>('/api/meetings?internId=me&upcoming=true&limit=1')
      setNextMeeting(result.data?.[0] ?? null)
    } catch (error) {
      setMeetingError(getErrorMessage(error))
    } finally {
      setLoadingMeeting(false)
    }
  }

  useEffect(() => {
    void loadInternship()
    void loadTasks()
    void loadDeliverables()
    void loadJournal()
    void loadEvaluations()
    void loadNextMeeting()
    void loadMeetingsCount()
  }, [])

  const handleCompleteTask = async (taskId: string) => {
    try {
      await api.patch(`/api/tasks/${taskId}/complete`, {})
      void loadTasks()
    } catch (error) {
      setTasksError(getErrorMessage(error))
    }
  }

  const handleAddJournalEntry = async () => {
    if (!journalContent.trim()) {
      setFormError(t('dashboard.form.required'))
      return
    }
    try {
      await api.post('/api/intern/me/journal', { content: journalContent })
      setIsJournalModalOpen(false)
      setJournalContent('')
      setFormError(null)
      void loadJournal()
    } catch (error) {
      setFormError(getErrorMessage(error))
    }
  }

  const handleFileUpload = async (deliverableId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    try {
      await api.postFormData(`/api/deliverables/${deliverableId}/submit`, formData)
      setSelectedDeliverableForUpload(null)
      void loadDeliverables()
    } catch (error) {
      setDeliverablesError(getErrorMessage(error))
    }
  }

  const handleUploadClick = (id: string) => {
    setSelectedDeliverableForUpload(id)
    setTimeout(() => fileInputRef.current?.click(), 0)
  }

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.name) return 'IN'
    const names = user.name.split(' ')
    return names.map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  // Get first name for greeting
  const getFirstName = () => {
    if (!user?.name) return ''
    return user.name.split(' ')[0]
  }

  return (
    <div className="intern-dashboard">
      <header className="intern-header">
        <div className="intern-welcome">
          <div className="intern-avatar">{getUserInitials()}</div>
          <div>
            <h1 className="intern-greeting">Welcome back{getFirstName() ? `, ${getFirstName()}` : ''}!</h1>
            <p className="intern-greeting-sub">Here&apos;s your internship overview</p>
          </div>
        </div>
      </header>

      <div className="intern-grid">
        <MissionCard
          internship={internship}
          loading={loadingInternship}
          error={internshipError}
          onRetry={loadInternship}
          t={t}
        />

        <QuickStatsCard
          tasks={tasks}
          deliverables={deliverables}
          internship={internship}
          meetingsCount={meetingsCount}
          loading={loadingInternship || loadingTasks || loadingDeliverables || loadingMeetingsCount}
        />

        <TasksCard
          tasks={tasks}
          loading={loadingTasks}
          error={tasksError}
          onRetry={loadTasks}
          onComplete={handleCompleteTask}
        />

        <DeliverablesCard
          deliverables={deliverables}
          loading={loadingDeliverables}
          error={deliverablesError}
          onRetry={loadDeliverables}
          onUploadClick={handleUploadClick}
          onViewComment={setCommentModalDeliverable}
        />

        <EvaluationCard
          evaluations={evaluations}
          loading={loadingEvaluations}
          error={evaluationsError}
          onRetry={loadEvaluations}
          t={t}
        />

        <JournalCard
          entries={journalEntries}
          loading={loadingJournal}
          error={journalError}
          onRetry={loadJournal}
          onAddClick={() => setIsJournalModalOpen(true)}
        />

        <MeetingCard
          meeting={nextMeeting}
          loading={loadingMeeting}
          error={meetingError}
          onRetry={loadNextMeeting}
        />
      </div>

      {/* Floating Add Button for Journal */}
      <button
        className="fab-button"
        onClick={() => setIsJournalModalOpen(true)}
        aria-label="Add journal entry"
      >
        +
      </button>

      <Modal isOpen={isJournalModalOpen} onClose={() => setIsJournalModalOpen(false)} title={t('dashboard.intern.addEntry')}>
        <form className="modal-form" onSubmit={(e) => { e.preventDefault(); void handleAddJournalEntry() }}>
          <div className="form-field">
            <textarea
              value={journalContent}
              onChange={(e) => setJournalContent(e.target.value)}
              rows={6}
              placeholder={t('dashboard.form.description')}
              className={formError ? 'input-error' : ''}
            />
            {formError && <span className="field-error">{formError}</span>}
          </div>
          <div className="modal-actions">
            <button type="button" className="button button-secondary button-sm" onClick={() => setIsJournalModalOpen(false)}>
              {t('dashboard.form.cancel')}
            </button>
            <button type="submit" className="button button-primary button-sm">
              {t('dashboard.form.save')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!commentModalDeliverable}
        onClose={() => setCommentModalDeliverable(null)}
        title={commentModalDeliverable?.title ?? ''}
      >
        <div className="comment-modal-content">
          <p className="supervisor-comment">{commentModalDeliverable?.supervisorComment}</p>
          <div className="modal-actions">
            <button type="button" className="button button-primary button-sm" onClick={() => setCommentModalDeliverable(null)}>
              {t('dashboard.form.close')}
            </button>
          </div>
        </div>
      </Modal>

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file && selectedDeliverableForUpload) {
            void handleFileUpload(selectedDeliverableForUpload, file)
          }
        }}
      />
    </div>
  )
}

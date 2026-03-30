import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { Modal } from '../components/Modal'
import { Skeleton } from '../components/Skeleton'
import { ErrorState } from '../components/ErrorState'
import { useDashboardApi } from '../hooks/useDashboardApi'

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

/**
 * Tableau de bord pour le rôle intern.
 * Affiche les informations du stage, les tâches, les livrables et le journal de bord.
 */
export function InternDashboard() {
  const { t } = useI18n()
  const api = useDashboardApi()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Data states
  const [internship, setInternship] = useState<Internship | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [nextMeeting, setNextMeeting] = useState<Meeting | null>(null)

  // Modal states
  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false)
  const [journalContent, setJournalContent] = useState('')
  const [selectedDeliverableForUpload, setSelectedDeliverableForUpload] = useState<string | null>(null)
  const [commentModalDeliverable, setCommentModalDeliverable] = useState<Deliverable | null>(null)

  // Progress update state
  const [deliverableProgress, setDeliverableProgress] = useState<Record<string, number>>({})
  const [savingProgress, setSavingProgress] = useState<Record<string, boolean>>({})

  // Loading states
  const [loadingInternship, setLoadingInternship] = useState(true)
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [loadingDeliverables, setLoadingDeliverables] = useState(true)
  const [loadingJournal, setLoadingJournal] = useState(true)
  const [loadingEvaluations, setLoadingEvaluations] = useState(true)
  const [loadingMeeting, setLoadingMeeting] = useState(true)

  // Error states
  const [internshipError, setInternshipError] = useState<string | null>(null)
  const [tasksError, setTasksError] = useState<string | null>(null)
  const [deliverablesError, setDeliverablesError] = useState<string | null>(null)
  const [journalError, setJournalError] = useState<string | null>(null)
  const [evaluationsError, setEvaluationsError] = useState<string | null>(null)
  const [meetingError, setMeetingError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const loadInternship = async () => {
    setLoadingInternship(true)
    setInternshipError(null)
    try {
      const result = await api.get<Internship>('/api/intern/me/internship')
      setInternship(result)
    } catch {
      setInternshipError(t('dashboard.error.load'))
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
    } catch {
      setTasksError(t('dashboard.error.load'))
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
      const progressMap: Record<string, number> = {}
      result.data?.forEach((d) => {
        progressMap[d.id] = d.progress
      })
      setDeliverableProgress(progressMap)
    } catch {
      setDeliverablesError(t('dashboard.error.load'))
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
    } catch {
      setJournalError(t('dashboard.error.load'))
    } finally {
      setLoadingJournal(false)
    }
  }

  const loadEvaluations = async () => {
    setLoadingEvaluations(true)
    setEvaluationsError(null)
    try {
      const result = await api.get<{ data: Evaluation[] }>('/api/intern/me/evaluations')
      setEvaluations(result.data ?? [])
    } catch {
      setEvaluationsError(t('dashboard.error.load'))
    } finally {
      setLoadingEvaluations(false)
    }
  }

  const loadNextMeeting = async () => {
    setLoadingMeeting(true)
    setMeetingError(null)
    try {
      const result = await api.get<Meeting | null>('/api/meetings?internId=me&upcoming=true')
      setNextMeeting(result)
    } catch {
      setMeetingError(t('dashboard.error.load'))
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
  }, [])

  const handleCompleteTask = async (taskId: string) => {
    try {
      await api.patch(`/api/tasks/${taskId}/complete`, {})
      void loadTasks()
    } catch {
      console.error('Failed to complete task')
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
    } catch {
      setFormError(t('dashboard.error.load'))
    }
  }

  const handleFileUpload = async (deliverableId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    try {
      await api.postFormData(`/api/deliverables/${deliverableId}/submit`, formData)
      setSelectedDeliverableForUpload(null)
      void loadDeliverables()
    } catch {
      console.error('Failed to upload file')
    }
  }

  const handleProgressChange = (deliverableId: string, value: number) => {
    setDeliverableProgress((prev) => ({ ...prev, [deliverableId]: value }))
  }

  const handleSaveProgress = async (deliverableId: string) => {
    setSavingProgress((prev) => ({ ...prev, [deliverableId]: true }))
    try {
      await api.patch(`/api/intern/me/deliverables/${deliverableId}/progress`, {
        progress: deliverableProgress[deliverableId],
      })
    } catch {
      console.error('Failed to save progress')
    } finally {
      setSavingProgress((prev) => ({ ...prev, [deliverableId]: false }))
    }
  }

  const getStatusLabel = (status: Deliverable['status']) => {
    switch (status) {
      case 'not_submitted':
        return t('dashboard.intern.notSubmitted')
      case 'submitted':
        return t('dashboard.intern.submitted')
      case 'accepted':
        return t('dashboard.intern.accepted')
      case 'rejected':
        return t('dashboard.intern.rejected')
      default:
        return status
    }
  }

  const getStatusClass = (status: Deliverable['status']) => {
    switch (status) {
      case 'not_submitted':
        return 'status-pending'
      case 'submitted':
        return 'status-submitted'
      case 'accepted':
        return 'status-accepted'
      case 'rejected':
        return 'status-rejected'
      default:
        return ''
    }
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1 className="dashboard-title">{t('dashboard.intern.title')}</h1>
      </header>

      {/* My Internship Card */}
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">{t('dashboard.intern.myInternship')}</h2>
        {loadingInternship ? (
          <Skeleton height="200px" />
        ) : internshipError ? (
          <ErrorState message={internshipError} onRetry={loadInternship} />
        ) : internship ? (
          <div className="internship-card">
            <div className="internship-info-grid">
              <div className="internship-info-item">
                <span className="info-label">{t('dashboard.intern.missionTitle')}</span>
                <span className="info-value">{internship.missionTitle}</span>
              </div>
              <div className="internship-info-item">
                <span className="info-label">{t('dashboard.intern.supervisorName')}</span>
                <span className="info-value">{internship.supervisorName}</span>
              </div>
              <div className="internship-info-item">
                <span className="info-label">{t('dashboard.intern.department')}</span>
                <span className="info-value">{internship.department}</span>
              </div>
              <div className="internship-info-item">
                <span className="info-label">{t('dashboard.intern.period')}</span>
                <span className="info-value">{internship.startDate} - {internship.endDate}</span>
              </div>
              <div className="internship-info-item">
                <span className="info-label">{t('dashboard.intern.status')}</span>
                <span className="info-value status-badge">{internship.status}</span>
              </div>
            </div>
            <div className="internship-progress-section">
              <span className="info-label">{t('dashboard.intern.progress')}</span>
              <div className="progress-bar-container progress-bar-large">
                <div className="progress-bar" style={{ width: `${internship.progress}%` }} />
                <span className="progress-label">{internship.progress}%</span>
              </div>
            </div>
          </div>
        ) : (
          <p className="empty-state">{t('dashboard.noData')}</p>
        )}
      </section>

      {/* My Task List */}
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">{t('dashboard.intern.taskList')}</h2>
        {loadingTasks ? (
          <Skeleton height="200px" />
        ) : tasksError ? (
          <ErrorState message={tasksError} onRetry={loadTasks} />
        ) : tasks.length === 0 ? (
          <p className="empty-state">{t('dashboard.noData')}</p>
        ) : (
          <ul className="task-list">
            {tasks.map((task) => (
              <li key={task.id} className={`task-item ${task.completed ? 'task-completed' : ''}`}>
                <label className="task-checkbox-label">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => !task.completed && handleCompleteTask(task.id)}
                    disabled={task.completed}
                    className="task-checkbox"
                  />
                  <span className="task-title">{task.title}</span>
                </label>
                <span className="task-due-date">{task.dueDate}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Deliverables Progress */}
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">{t('dashboard.intern.deliverables')}</h2>
        {loadingDeliverables ? (
          <Skeleton height="300px" />
        ) : deliverablesError ? (
          <ErrorState message={deliverablesError} onRetry={loadDeliverables} />
        ) : deliverables.length === 0 ? (
          <p className="empty-state">{t('dashboard.noData')}</p>
        ) : (
          <div className="deliverables-grid">
            {deliverables.map((deliverable) => (
              <div key={deliverable.id} className="deliverable-card">
                <div className="deliverable-header">
                  <h3 className="deliverable-title">{deliverable.title}</h3>
                  <span className={`deliverable-status ${getStatusClass(deliverable.status)}`}>
                    {getStatusLabel(deliverable.status)}
                    {deliverable.status === 'submitted' && ` v${deliverable.version}`}
                  </span>
                </div>
                <p className="deliverable-due-date">{t('dashboard.table.dueDate')}: {deliverable.dueDate}</p>
                <div className="deliverable-actions">
                  <input
                    type="file"
                    ref={selectedDeliverableForUpload === deliverable.id ? fileInputRef : null}
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(deliverable.id, file)
                    }}
                  />
                  <button
                    className="button button-secondary button-sm"
                    onClick={() => {
                      setSelectedDeliverableForUpload(deliverable.id)
                      setTimeout(() => fileInputRef.current?.click(), 0)
                    }}
                  >
                    {t('dashboard.intern.uploadFile')}
                  </button>
                  {deliverable.status === 'rejected' && deliverable.supervisorComment && (
                    <button
                      className="action-button"
                      onClick={() => setCommentModalDeliverable(deliverable)}
                    >
                      {t('dashboard.intern.viewComment')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Journal de Bord */}
      <section className="dashboard-section">
        <div className="section-header-row">
          <h2 className="dashboard-section-title">{t('dashboard.intern.journal')}</h2>
          <button className="button button-primary button-sm" onClick={() => setIsJournalModalOpen(true)}>
            {t('dashboard.intern.addEntry')}
          </button>
        </div>
        {loadingJournal ? (
          <Skeleton height="200px" />
        ) : journalError ? (
          <ErrorState message={journalError} onRetry={loadJournal} />
        ) : journalEntries.length === 0 ? (
          <p className="empty-state">{t('dashboard.noData')}</p>
        ) : (
          <div className="journal-entries">
            {journalEntries.map((entry) => (
              <div key={entry.id} className="journal-entry">
                <p className="journal-content">{entry.content}</p>
                <span className="journal-date">{entry.createdAt}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Advancement Input */}
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">{t('dashboard.intern.advancement')}</h2>
        {loadingDeliverables ? (
          <Skeleton height="200px" />
        ) : deliverables.length === 0 ? (
          <p className="empty-state">{t('dashboard.noData')}</p>
        ) : (
          <div className="advancement-grid">
            {deliverables.map((deliverable) => (
              <div key={deliverable.id} className="advancement-item">
                <label className="advancement-label">{deliverable.title}</label>
                <div className="advancement-controls">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={deliverableProgress[deliverable.id] ?? 0}
                    onChange={(e) => handleProgressChange(deliverable.id, parseInt(e.target.value, 10))}
                    className="advancement-slider"
                  />
                  <span className="advancement-value">{deliverableProgress[deliverable.id] ?? 0}%</span>
                  <button
                    className="button button-primary button-sm"
                    onClick={() => handleSaveProgress(deliverable.id)}
                    disabled={savingProgress[deliverable.id]}
                  >
                    {savingProgress[deliverable.id] ? '...' : t('dashboard.intern.saveProgress')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* My Evaluations */}
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">{t('dashboard.intern.myEvaluations')}</h2>
        {loadingEvaluations ? (
          <Skeleton height="200px" />
        ) : evaluationsError ? (
          <ErrorState message={evaluationsError} onRetry={loadEvaluations} />
        ) : evaluations.length === 0 ? (
          <p className="empty-state">{t('dashboard.noData')}</p>
        ) : (
          <div className="evaluations-grid">
            {evaluations.map((evaluation) => (
              <div key={evaluation.id} className="evaluation-card">
                <h3 className="evaluation-type">
                  {evaluation.type === 'mid_term' ? t('dashboard.evaluation.midTerm') : t('dashboard.evaluation.endOfInternship')}
                </h3>
                <p className="evaluation-date">{evaluation.date}</p>
                <div className="evaluation-scores">
                  <div className="score-item">
                    <span>{t('dashboard.evaluation.technical')}</span>
                    <span>{evaluation.scores.technical}/10</span>
                  </div>
                  <div className="score-item">
                    <span>{t('dashboard.evaluation.autonomy')}</span>
                    <span>{evaluation.scores.autonomy}/10</span>
                  </div>
                  <div className="score-item">
                    <span>{t('dashboard.evaluation.communication')}</span>
                    <span>{evaluation.scores.communication}/10</span>
                  </div>
                  <div className="score-item">
                    <span>{t('dashboard.evaluation.deadlineRespect')}</span>
                    <span>{evaluation.scores.deadlineRespect}/10</span>
                  </div>
                  <div className="score-item">
                    <span>{t('dashboard.evaluation.deliverableQuality')}</span>
                    <span>{evaluation.scores.deliverableQuality}/10</span>
                  </div>
                </div>
                {evaluation.comments && (
                  <p className="evaluation-comments">{evaluation.comments}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Next Meeting */}
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">{t('dashboard.intern.nextMeeting')}</h2>
        {loadingMeeting ? (
          <Skeleton height="100px" />
        ) : meetingError ? (
          <ErrorState message={meetingError} onRetry={loadNextMeeting} />
        ) : nextMeeting ? (
          <div className="next-meeting-card">
            <p className="meeting-date">{nextMeeting.date}</p>
            <p className="meeting-supervisor">{nextMeeting.supervisorName}</p>
            {nextMeeting.notes && <p className="meeting-notes">{nextMeeting.notes}</p>}
          </div>
        ) : (
          <p className="empty-state">{t('dashboard.intern.noMeeting')}</p>
        )}
      </section>

      {/* Add Journal Entry Modal */}
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

      {/* View Comment Modal */}
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

      {/* Hidden file input for uploads */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file && selectedDeliverableForUpload) {
            handleFileUpload(selectedDeliverableForUpload, file)
          }
        }}
      />
    </div>
  )
}

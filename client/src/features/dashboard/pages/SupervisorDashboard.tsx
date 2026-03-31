import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { KPICard } from '../components/KPICard'
import { DataTable } from '../components/DataTable'
import { Modal } from '../components/Modal'
import { Skeleton } from '../components/Skeleton'
import { ErrorState } from '../components/ErrorState'
import { useDashboardApi } from '../hooks/useDashboardApi'

interface Intern {
  id: string
  name: string
  missionTitle: string
  progress: number
  lastJournalDate: string | null
  isOverdue: boolean
}

interface Mission {
  id: string
  title: string
  internName: string | null
  status: string
  deliverablesCount: number
}

interface Deliverable {
  id: string
  internName: string
  title: string
  submittedDate: string
  fileUrl: string
  version: number
}

interface Evaluation {
  id: string
  internId?: string
  internName: string
  type: 'mid_term' | 'end_of_internship'
}

interface Meeting {
  id: string
  internName: string
  date: string
  notes: string
}

interface Skill {
  id: string
  name: string
}

/**
 * Tableau de bord pour le rôle supervisor.
 * Gère les missions, les livrables, les évaluations et les réunions.
 */
export function SupervisorDashboard() {
  const { t } = useI18n()
  const api = useDashboardApi()
  const navigate = useNavigate()

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message.trim()) {
      return error.message
    }

    return t('dashboard.error.load')
  }

  // KPI states
  const [activeInternsCount, setActiveInternsCount] = useState<number | null>(null)
  const [pendingValidationsCount, setPendingValidationsCount] = useState<number | null>(null)
  const [avgProgress, setAvgProgress] = useState<number | null>(null)
  const [overdueCount, setOverdueCount] = useState<number | null>(null)

  // Data states
  const [interns, setInterns] = useState<Intern[]>([])
  const [missions, setMissions] = useState<Mission[]>([])
  const [pendingDeliverables, setPendingDeliverables] = useState<Deliverable[]>([])
  const [pendingEvaluations, setPendingEvaluations] = useState<Evaluation[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [skills, setSkills] = useState<Skill[]>([])

  // Modal states
  const [isCreateMissionModalOpen, setIsCreateMissionModalOpen] = useState(false)
  const [isAddMeetingModalOpen, setIsAddMeetingModalOpen] = useState(false)
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false)
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false)
  const [selectedDeliverable, setSelectedDeliverable] = useState<Deliverable | null>(null)
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null)

  // Form states
  const [missionFormData, setMissionFormData] = useState({
    title: '',
    description: '',
    skills: [] as string[],
    tools: '',
    level: 'junior',
    deliverables: '',
  })
  const [meetingFormData, setMeetingFormData] = useState({ internId: '', date: '', note: '' })
  const [validationComment, setValidationComment] = useState('')
  const [evaluationScores, setEvaluationScores] = useState({
    technical: 0,
    autonomy: 0,
    communication: 0,
    deadlineRespect: 0,
    deliverableQuality: 0,
    comments: '',
  })

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  // Loading states
  const [loadingKpis, setLoadingKpis] = useState(true)
  const [loadingInterns, setLoadingInterns] = useState(true)
  const [loadingMissions, setLoadingMissions] = useState(true)
  const [loadingDeliverables, setLoadingDeliverables] = useState(true)
  const [loadingEvaluations, setLoadingEvaluations] = useState(true)
  const [loadingMeetings, setLoadingMeetings] = useState(true)

  // Error states
  const [kpisError, setKpisError] = useState<string | null>(null)
  const [internsError, setInternsError] = useState<string | null>(null)
  const [missionsError, setMissionsError] = useState<string | null>(null)
  const [deliverablesError, setDeliverablesError] = useState<string | null>(null)
  const [evaluationsError, setEvaluationsError] = useState<string | null>(null)
  const [meetingsError, setMeetingsError] = useState<string | null>(null)

  const loadKpis = async () => {
    setLoadingKpis(true)
    setKpisError(null)
    try {
      const [activeInterns, pending, avg, overdue] = await Promise.all([
        api.get<{ count: number }>('/api/stats/supervisor/me/interns/active'),
        api.get<{ count: number }>('/api/stats/supervisor/me/deliverables/pending'),
        api.get<{ value: number }>('/api/stats/supervisor/me/avg-progress'),
        api.get<{ count: number }>('/api/stats/supervisor/me/overdue'),
      ])
      setActiveInternsCount(activeInterns.count)
      setPendingValidationsCount(pending.count)
      setAvgProgress(avg.value)
      setOverdueCount(overdue.count)
    } catch (error) {
      setKpisError(getErrorMessage(error))
    } finally {
      setLoadingKpis(false)
    }
  }

  const loadInterns = async () => {
    setLoadingInterns(true)
    setInternsError(null)
    try {
      const result = await api.get<{ data: Intern[] }>('/api/supervisor/me/interns')
      setInterns(result.data ?? [])
    } catch (error) {
      setInternsError(getErrorMessage(error))
    } finally {
      setLoadingInterns(false)
    }
  }

  const loadMissions = async () => {
    setLoadingMissions(true)
    setMissionsError(null)
    try {
      const result = await api.get<{ data: Mission[] }>('/api/missions?supervisorId=me')
      setMissions(result.data ?? [])
    } catch (error) {
      setMissionsError(getErrorMessage(error))
    } finally {
      setLoadingMissions(false)
    }
  }

  const loadDeliverables = async () => {
    setLoadingDeliverables(true)
    setDeliverablesError(null)
    try {
      const result = await api.get<{ data: Deliverable[] }>('/api/deliverables?status=pending&supervisorId=me')
      setPendingDeliverables(result.data ?? [])
    } catch (error) {
      setDeliverablesError(getErrorMessage(error))
    } finally {
      setLoadingDeliverables(false)
    }
  }

  const loadEvaluations = async () => {
    setLoadingEvaluations(true)
    setEvaluationsError(null)
    try {
      const result = await api.get<{ data: Evaluation[] }>('/api/evaluations/pending?supervisorId=me')
      setPendingEvaluations(result.data ?? [])
    } catch (error) {
      setEvaluationsError(getErrorMessage(error))
    } finally {
      setLoadingEvaluations(false)
    }
  }

  const loadMeetings = async () => {
    setLoadingMeetings(true)
    setMeetingsError(null)
    try {
      const result = await api.get<{ data: Meeting[] }>('/api/meetings?supervisorId=me')
      setMeetings(result.data ?? [])
    } catch (error) {
      setMeetingsError(getErrorMessage(error))
    } finally {
      setLoadingMeetings(false)
    }
  }

  const loadSkills = async () => {
    try {
      const result = await api.get<Skill[]>('/api/admin/settings/skills')
      setSkills(result ?? [])
    } catch (error) {
      setMissionsError(getErrorMessage(error))
    }
  }

  useEffect(() => {
    void loadKpis()
    void loadInterns()
    void loadMissions()
    void loadDeliverables()
    void loadEvaluations()
    void loadMeetings()
    void loadSkills()
  }, [])

  const handleCreateMission = async () => {
    const errors: Record<string, string> = {}
    if (!missionFormData.title.trim()) errors.title = t('dashboard.form.required')
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    try {
      await api.post('/api/missions', {
        ...missionFormData,
        deliverables: missionFormData.deliverables.split('\n').filter(Boolean),
      })
      setIsCreateMissionModalOpen(false)
      setMissionFormData({ title: '', description: '', skills: [], tools: '', level: 'junior', deliverables: '' })
      void loadMissions()
    } catch (error) {
      setFormErrors({ submit: getErrorMessage(error) })
    }
  }

  const handleAddMeeting = async () => {
    const errors: Record<string, string> = {}
    if (!meetingFormData.internId) errors.internId = t('dashboard.form.required')
    if (!meetingFormData.date) errors.date = t('dashboard.form.required')
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    try {
      await api.post('/api/meetings', {
        internId: meetingFormData.internId,
        date: meetingFormData.date,
        notes: meetingFormData.note,
      })
      setIsAddMeetingModalOpen(false)
      setMeetingFormData({ internId: '', date: '', note: '' })
      void loadMeetings()
    } catch (error) {
      setFormErrors({ submit: getErrorMessage(error) })
    }
  }

  const handleValidateDeliverable = async (action: 'accept' | 'reject') => {
    if (!selectedDeliverable) return
    if (action === 'reject' && !validationComment.trim()) {
      setFormErrors({ comment: t('dashboard.form.commentRequired') })
      return
    }

    try {
      await api.patch(`/api/deliverables/${selectedDeliverable.id}/validate`, {
        action,
        comment: validationComment,
      })
      setIsValidationModalOpen(false)
      setSelectedDeliverable(null)
      setValidationComment('')
      void loadDeliverables()
    } catch (error) {
      setFormErrors({ submit: getErrorMessage(error) })
    }
  }

  const handleSubmitEvaluation = async () => {
    if (!selectedEvaluation) return

    try {
      await api.post('/api/evaluations', {
        internId: selectedEvaluation.internId ?? selectedEvaluation.id,
        type: selectedEvaluation.type,
        scores: {
          technical: evaluationScores.technical,
          autonomy: evaluationScores.autonomy,
          communication: evaluationScores.communication,
          deadlineRespect: evaluationScores.deadlineRespect,
          deliverableQuality: evaluationScores.deliverableQuality,
        },
        comments: evaluationScores.comments,
      })
      setIsEvaluationModalOpen(false)
      setSelectedEvaluation(null)
      setEvaluationScores({
        technical: 0,
        autonomy: 0,
        communication: 0,
        deadlineRespect: 0,
        deliverableQuality: 0,
        comments: '',
      })
      void loadEvaluations()
    } catch (error) {
      setFormErrors({ submit: getErrorMessage(error) })
    }
  }

  const openValidationModal = (deliverable: Deliverable) => {
    setSelectedDeliverable(deliverable)
    setIsValidationModalOpen(true)
    setValidationComment('')
    setFormErrors({})
  }

  const openEvaluationModal = (evaluation: Evaluation) => {
    setSelectedEvaluation(evaluation)
    setIsEvaluationModalOpen(true)
    setEvaluationScores({
      technical: 0,
      autonomy: 0,
      communication: 0,
      deadlineRespect: 0,
      deliverableQuality: 0,
      comments: '',
    })
    setFormErrors({})
  }

  const missionColumns = [
    { key: 'title', label: t('dashboard.table.title') },
    { key: 'internName', label: t('dashboard.table.intern') },
    { key: 'status', label: t('dashboard.table.status') },
    { key: 'deliverablesCount', label: t('dashboard.table.deliverables') },
  ]

  const meetingColumns = [
    { key: 'internName', label: t('dashboard.table.intern') },
    { key: 'date', label: t('dashboard.table.date') },
    { key: 'notes', label: t('dashboard.table.notes') },
  ]

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1 className="dashboard-title">{t('dashboard.supervisor.title')}</h1>
      </header>

      {/* KPI Summary Cards */}
      <section className="dashboard-section">
        <div className="kpi-grid">
          {loadingKpis ? (
            <>
              <Skeleton height="120px" />
              <Skeleton height="120px" />
              <Skeleton height="120px" />
              <Skeleton height="120px" />
            </>
          ) : kpisError ? (
            <ErrorState message={kpisError} onRetry={loadKpis} />
          ) : (
            <>
              <KPICard title={t('dashboard.kpi.myActiveInterns')} value={activeInternsCount ?? 0} />
              <KPICard title={t('dashboard.kpi.pendingValidations')} value={pendingValidationsCount ?? 0} />
              <KPICard title={t('dashboard.kpi.avgProgress')} value={`${avgProgress ?? 0}%`} />
              <KPICard title={t('dashboard.kpi.overdueInterns')} value={overdueCount ?? 0} variant={overdueCount && overdueCount > 0 ? 'warning' : 'default'} />
            </>
          )}
        </div>
      </section>

      {/* My Interns - Progress Overview */}
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">{t('dashboard.supervisor.myInterns')}</h2>
        {loadingInterns ? (
          <div className="intern-cards-grid">
            <Skeleton height="180px" />
            <Skeleton height="180px" />
            <Skeleton height="180px" />
          </div>
        ) : internsError ? (
          <ErrorState message={internsError} onRetry={loadInterns} />
        ) : interns.length === 0 ? (
          <p className="empty-state">{t('dashboard.noData')}</p>
        ) : (
          <div className="intern-cards-grid">
            {interns.map((intern) => (
              <div
                key={intern.id}
                className={`intern-card ${intern.isOverdue ? 'intern-card-overdue' : ''}`}
                onClick={() => navigate(`/interns/${intern.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/interns/${intern.id}`)}
              >
                <h3 className="intern-card-name">{intern.name}</h3>
                <p className="intern-card-mission">{intern.missionTitle}</p>
                <div className="progress-bar-container">
                  <div className="progress-bar" style={{ width: `${intern.progress}%` }} />
                  <span className="progress-label">{intern.progress}%</span>
                </div>
                <p className="intern-card-journal">
                  {t('dashboard.supervisor.lastJournal')}: {intern.lastJournalDate ?? '-'}
                </p>
                {intern.isOverdue && (
                  <span className="overdue-badge">{t('dashboard.supervisor.overdue')}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Missions Management */}
      <section className="dashboard-section">
        <div className="section-header-row">
          <h2 className="dashboard-section-title">{t('dashboard.supervisor.missions')}</h2>
          <button className="button button-primary button-sm" onClick={() => setIsCreateMissionModalOpen(true)}>
            {t('dashboard.supervisor.createMission')}
          </button>
        </div>
        {loadingMissions ? (
          <Skeleton height="200px" />
        ) : missionsError ? (
          <ErrorState message={missionsError} onRetry={loadMissions} />
        ) : missions.length === 0 ? (
          <p className="empty-state">{t('dashboard.noData')}</p>
        ) : (
          <DataTable columns={missionColumns} data={missions.map((m) => ({ ...m, internName: m.internName ?? '-' }))} />
        )}
      </section>

      {/* Pending Deliverables Validation Queue */}
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">{t('dashboard.supervisor.pendingDeliverables')}</h2>
        {loadingDeliverables ? (
          <Skeleton height="200px" />
        ) : deliverablesError ? (
          <ErrorState message={deliverablesError} onRetry={loadDeliverables} />
        ) : pendingDeliverables.length === 0 ? (
          <p className="empty-state">{t('dashboard.noData')}</p>
        ) : (
          <div className="deliverables-list">
            {pendingDeliverables.map((deliverable) => (
              <div key={deliverable.id} className="deliverable-item">
                <div className="deliverable-info">
                  <span className="deliverable-intern">{deliverable.internName}</span>
                  <span className="deliverable-title">{deliverable.title}</span>
                  <span className="deliverable-date">{deliverable.submittedDate}</span>
                  <span className="deliverable-version">v{deliverable.version}</span>
                </div>
                <div className="deliverable-actions">
                  <a href={deliverable.fileUrl} target="_blank" rel="noopener noreferrer" className="action-button">
                    View
                  </a>
                  <button className="button button-primary button-sm" onClick={() => openValidationModal(deliverable)}>
                    {t('dashboard.supervisor.accept')}
                  </button>
                  <button className="button button-secondary button-sm" onClick={() => openValidationModal(deliverable)}>
                    {t('dashboard.supervisor.reject')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Evaluations Due */}
      <section className="dashboard-section">
        <h2 className="dashboard-section-title">{t('dashboard.supervisor.evaluationsDue')}</h2>
        {loadingEvaluations ? (
          <Skeleton height="150px" />
        ) : evaluationsError ? (
          <ErrorState message={evaluationsError} onRetry={loadEvaluations} />
        ) : pendingEvaluations.length === 0 ? (
          <p className="empty-state">{t('dashboard.noData')}</p>
        ) : (
          <div className="evaluations-list">
            {pendingEvaluations.map((evaluation) => (
              <div key={evaluation.id} className="evaluation-item">
                <span className="evaluation-intern">{evaluation.internName}</span>
                <span className="evaluation-type">
                  {evaluation.type === 'mid_term' ? t('dashboard.evaluation.midTerm') : t('dashboard.evaluation.endOfInternship')}
                </span>
                <button className="button button-primary button-sm" onClick={() => openEvaluationModal(evaluation)}>
                  {t('dashboard.supervisor.evaluate')}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Upcoming Meetings */}
      <section className="dashboard-section">
        <div className="section-header-row">
          <h2 className="dashboard-section-title">{t('dashboard.supervisor.meetings')}</h2>
          <button className="button button-primary button-sm" onClick={() => setIsAddMeetingModalOpen(true)}>
            {t('dashboard.supervisor.addMeeting')}
          </button>
        </div>
        {loadingMeetings ? (
          <Skeleton height="200px" />
        ) : meetingsError ? (
          <ErrorState message={meetingsError} onRetry={loadMeetings} />
        ) : meetings.length === 0 ? (
          <p className="empty-state">{t('dashboard.noData')}</p>
        ) : (
          <DataTable columns={meetingColumns} data={meetings} />
        )}
      </section>

      {/* Create Mission Modal */}
      <Modal isOpen={isCreateMissionModalOpen} onClose={() => setIsCreateMissionModalOpen(false)} title={t('dashboard.supervisor.createMission')}>
        <form className="modal-form" onSubmit={(e) => { e.preventDefault(); void handleCreateMission() }}>
          <div className="form-field">
            <label htmlFor="mission-title">{t('dashboard.form.title')}</label>
            <input
              id="mission-title"
              type="text"
              value={missionFormData.title}
              onChange={(e) => setMissionFormData({ ...missionFormData, title: e.target.value })}
              className={formErrors.title ? 'input-error' : ''}
            />
            {formErrors.title && <span className="field-error">{formErrors.title}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="mission-description">{t('dashboard.form.description')}</label>
            <textarea
              id="mission-description"
              value={missionFormData.description}
              onChange={(e) => setMissionFormData({ ...missionFormData, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="form-field">
            <label htmlFor="mission-skills">{t('dashboard.form.skills')}</label>
            <select
              id="mission-skills"
              multiple
              value={missionFormData.skills}
              onChange={(e) => setMissionFormData({
                ...missionFormData,
                skills: Array.from(e.target.selectedOptions, (o) => o.value),
              })}
            >
              {skills.map((skill) => (
                <option key={skill.id} value={skill.id}>{skill.name}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="mission-tools">{t('dashboard.form.tools')}</label>
            <input
              id="mission-tools"
              type="text"
              value={missionFormData.tools}
              onChange={(e) => setMissionFormData({ ...missionFormData, tools: e.target.value })}
              placeholder="e.g. React, Node.js, PostgreSQL"
            />
          </div>
          <div className="form-field">
            <label htmlFor="mission-level">{t('dashboard.form.level')}</label>
            <select
              id="mission-level"
              value={missionFormData.level}
              onChange={(e) => setMissionFormData({ ...missionFormData, level: e.target.value })}
            >
              <option value="junior">Junior</option>
              <option value="intermediate">Intermediate</option>
              <option value="senior">Senior</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="mission-deliverables">{t('dashboard.form.deliverables')}</label>
            <textarea
              id="mission-deliverables"
              value={missionFormData.deliverables}
              onChange={(e) => setMissionFormData({ ...missionFormData, deliverables: e.target.value })}
              rows={4}
              placeholder="One deliverable per line"
            />
          </div>
          {formErrors.submit && <p className="form-error">{formErrors.submit}</p>}
          <div className="modal-actions">
            <button type="button" className="button button-secondary button-sm" onClick={() => setIsCreateMissionModalOpen(false)}>
              {t('dashboard.form.cancel')}
            </button>
            <button type="submit" className="button button-primary button-sm">
              {t('dashboard.form.save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Meeting Modal */}
      <Modal isOpen={isAddMeetingModalOpen} onClose={() => setIsAddMeetingModalOpen(false)} title={t('dashboard.supervisor.addMeeting')}>
        <form className="modal-form" onSubmit={(e) => { e.preventDefault(); void handleAddMeeting() }}>
          <div className="form-field">
            <label htmlFor="meeting-intern">{t('dashboard.form.intern')}</label>
            <select
              id="meeting-intern"
              value={meetingFormData.internId}
              onChange={(e) => setMeetingFormData({ ...meetingFormData, internId: e.target.value })}
              className={formErrors.internId ? 'input-error' : ''}
            >
              <option value="">--</option>
              {interns.map((intern) => (
                <option key={intern.id} value={intern.id}>{intern.name}</option>
              ))}
            </select>
            {formErrors.internId && <span className="field-error">{formErrors.internId}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="meeting-date">{t('dashboard.form.date')}</label>
            <input
              id="meeting-date"
              type="datetime-local"
              value={meetingFormData.date}
              onChange={(e) => setMeetingFormData({ ...meetingFormData, date: e.target.value })}
              className={formErrors.date ? 'input-error' : ''}
            />
            {formErrors.date && <span className="field-error">{formErrors.date}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="meeting-note">{t('dashboard.form.note')}</label>
            <textarea
              id="meeting-note"
              value={meetingFormData.note}
              onChange={(e) => setMeetingFormData({ ...meetingFormData, note: e.target.value })}
              rows={3}
            />
          </div>
          {formErrors.submit && <p className="form-error">{formErrors.submit}</p>}
          <div className="modal-actions">
            <button type="button" className="button button-secondary button-sm" onClick={() => setIsAddMeetingModalOpen(false)}>
              {t('dashboard.form.cancel')}
            </button>
            <button type="submit" className="button button-primary button-sm">
              {t('dashboard.form.save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Validation Modal */}
      <Modal isOpen={isValidationModalOpen} onClose={() => setIsValidationModalOpen(false)} title={selectedDeliverable?.title ?? ''}>
        <div className="modal-form">
          <p><strong>{t('dashboard.table.intern')}:</strong> {selectedDeliverable?.internName}</p>
          <p><strong>{t('dashboard.table.submittedDate')}:</strong> {selectedDeliverable?.submittedDate}</p>
          <p><strong>{t('dashboard.table.version')}:</strong> v{selectedDeliverable?.version}</p>
          <div className="form-field">
            <label htmlFor="validation-comment">{t('dashboard.form.comment')}</label>
            <textarea
              id="validation-comment"
              value={validationComment}
              onChange={(e) => setValidationComment(e.target.value)}
              rows={3}
              className={formErrors.comment ? 'input-error' : ''}
            />
            {formErrors.comment && <span className="field-error">{formErrors.comment}</span>}
          </div>
          {formErrors.submit && <p className="form-error">{formErrors.submit}</p>}
          <div className="modal-actions">
            <button type="button" className="button button-secondary button-sm" onClick={() => void handleValidateDeliverable('reject')}>
              {t('dashboard.supervisor.reject')}
            </button>
            <button type="button" className="button button-primary button-sm" onClick={() => void handleValidateDeliverable('accept')}>
              {t('dashboard.supervisor.accept')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Evaluation Modal */}
      <Modal isOpen={isEvaluationModalOpen} onClose={() => setIsEvaluationModalOpen(false)} title={selectedEvaluation?.internName ?? ''}>
        <form className="modal-form" onSubmit={(e) => { e.preventDefault(); void handleSubmitEvaluation() }}>
          <p className="evaluation-type-label">
            {selectedEvaluation?.type === 'mid_term' ? t('dashboard.evaluation.midTerm') : t('dashboard.evaluation.endOfInternship')}
          </p>
          {[
            { key: 'technical', label: t('dashboard.evaluation.technical') },
            { key: 'autonomy', label: t('dashboard.evaluation.autonomy') },
            { key: 'communication', label: t('dashboard.evaluation.communication') },
            { key: 'deadlineRespect', label: t('dashboard.evaluation.deadlineRespect') },
            { key: 'deliverableQuality', label: t('dashboard.evaluation.deliverableQuality') },
          ].map((criterion) => (
            <div key={criterion.key} className="evaluation-criterion">
              <label>{criterion.label}</label>
              <input
                type="range"
                min="0"
                max="10"
                value={evaluationScores[criterion.key as keyof typeof evaluationScores] as number}
                onChange={(e) => setEvaluationScores({
                  ...evaluationScores,
                  [criterion.key]: parseInt(e.target.value, 10),
                })}
              />
              <span className="score-value">{evaluationScores[criterion.key as keyof typeof evaluationScores]}/10</span>
            </div>
          ))}
          <div className="form-field">
            <label htmlFor="evaluation-comments">{t('dashboard.evaluation.comments')}</label>
            <textarea
              id="evaluation-comments"
              value={evaluationScores.comments}
              onChange={(e) => setEvaluationScores({ ...evaluationScores, comments: e.target.value })}
              rows={4}
            />
          </div>
          {formErrors.submit && <p className="form-error">{formErrors.submit}</p>}
          <div className="modal-actions">
            <button type="button" className="button button-secondary button-sm" onClick={() => setIsEvaluationModalOpen(false)}>
              {t('dashboard.form.cancel')}
            </button>
            <button type="submit" className="button button-primary button-sm">
              {t('dashboard.form.submit')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

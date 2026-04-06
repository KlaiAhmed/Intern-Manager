import { DataTable } from '../../components/DataTable'
import { ErrorState } from '../../components/ErrorState'
import { KPICard } from '../../components/KPICard'
import { Modal } from '../../components/Modal'
import { Skeleton } from '../../components/Skeleton'
import { useSupervisorDashboardState } from './useSupervisorDashboardState'
interface SupervisorDashboardViewProps {
  state: ReturnType<typeof useSupervisorDashboardState>
}
export function SupervisorDashboardView({ state }: SupervisorDashboardViewProps) {
  const {
    t,
    activeInternsCount,
    pendingValidationsCount,
    avgProgress,
    overdueCount,
    interns,
    missions,
    pendingDeliverables,
    pendingEvaluations,
    meetings,
    skills,
    pendingInternOptions,
    successToast,
    isCreateMissionModalOpen,
    setIsCreateMissionModalOpen,
    isAddMeetingModalOpen,
    setIsAddMeetingModalOpen,
    isEvaluationModalOpen,
    setIsEvaluationModalOpen,
    isValidationModalOpen,
    setIsValidationModalOpen,
    selectedDeliverable,
    selectedEvaluation,
    missionFormData,
    setMissionFormData,
    assignmentFormData,
    setAssignmentFormData,
    meetingFormData,
    setMeetingFormData,
    validationComment,
    setValidationComment,
    evaluationScores,
    setEvaluationScores,
    formErrors,
    loadingKpis,
    loadingInterns,
    loadingMissions,
    loadingDeliverables,
    loadingEvaluations,
    loadingMeetings,
    kpisError,
    internsError,
    missionsError,
    deliverablesError,
    evaluationsError,
    meetingsError,
    loadKpis,
    loadInterns,
    loadMissions,
    loadDeliverables,
    loadEvaluations,
    loadMeetings,
    handleCreateMission,
    handleAddMeeting,
    handleValidateDeliverable,
    handleSubmitEvaluation,
    openValidationModal,
    openEvaluationModal,
    closeCreateMissionModal,
    openInternProfile,
    missionColumns,
    meetingColumns,
  } = state
  return (
    <div className="dashboard-container">
      {successToast && (
        <div className="supervisor-success-toast" role="status" aria-live="polite">
          {successToast}
        </div>
      )}
      <header className="dashboard-header">
        <h1 className="dashboard-title">{t('dashboard.supervisor.title')}</h1>
      </header>
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
                onClick={() => openInternProfile(intern.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => event.key === 'Enter' && openInternProfile(intern.id)}
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
          <DataTable columns={missionColumns} data={missions.map((mission) => ({ ...mission, internName: mission.internName ?? '-' }))} />
        )}
      </section>
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
      <Modal isOpen={isCreateMissionModalOpen} onClose={closeCreateMissionModal} title={t('dashboard.supervisor.createMission')}>
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); void handleCreateMission() }}>
          <div className="form-field">
            <label htmlFor="mission-title">{t('dashboard.form.title')}</label>
            <input
              id="mission-title"
              type="text"
              value={missionFormData.title}
              onChange={(event) => setMissionFormData({ ...missionFormData, title: event.target.value })}
              className={formErrors.title ? 'input-error' : ''}
            />
            {formErrors.title && <span className="field-error">{formErrors.title}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="mission-description">{t('dashboard.form.description')}</label>
            <textarea
              id="mission-description"
              value={missionFormData.description}
              onChange={(event) => setMissionFormData({ ...missionFormData, description: event.target.value })}
              rows={3}
            />
          </div>
          <div className="form-field">
            <label htmlFor="mission-skills">{t('dashboard.form.skills')}</label>
            <select
              id="mission-skills"
              multiple
              value={missionFormData.skills}
              onChange={(event) => setMissionFormData({
                ...missionFormData,
                skills: Array.from(event.target.selectedOptions, (option) => option.value),
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
              onChange={(event) => setMissionFormData({ ...missionFormData, tools: event.target.value })}
              placeholder="e.g. React, Node.js, PostgreSQL"
            />
          </div>
          <div className="form-field">
            <label htmlFor="mission-level">{t('dashboard.form.level')}</label>
            <select
              id="mission-level"
              value={missionFormData.level}
              onChange={(event) => setMissionFormData({ ...missionFormData, level: event.target.value })}
            >
              <option value="junior">Junior</option>
              <option value="intermediate">Intermediate</option>
              <option value="senior">Senior</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="mission-pending-intern">Assign pending intern (optional)</label>
            <select
              id="mission-pending-intern"
              value={assignmentFormData.internId}
              onChange={(event) => setAssignmentFormData({ ...assignmentFormData, internId: event.target.value })}
            >
              <option value="">Create as template mission</option>
              {pendingInternOptions.map((intern) => (
                <option key={intern.id} value={intern.id}>
                  {intern.fullName} - {intern.status}
                </option>
              ))}
            </select>
            <span className="field-helper">Only interns with status PENDING are shown.</span>
          </div>
          {assignmentFormData.internId && (
            <>
              <div className="form-field">
                <label htmlFor="mission-start-date">Stage start date</label>
                <input
                  id="mission-start-date"
                  type="date"
                  value={assignmentFormData.startDate}
                  onChange={(event) => setAssignmentFormData({ ...assignmentFormData, startDate: event.target.value })}
                  className={formErrors.startDate ? 'input-error' : ''}
                />
                {formErrors.startDate && <span className="field-error">{formErrors.startDate}</span>}
              </div>
              <div className="form-field">
                <label htmlFor="mission-end-date">Stage end date</label>
                <input
                  id="mission-end-date"
                  type="date"
                  value={assignmentFormData.endDate}
                  onChange={(event) => setAssignmentFormData({ ...assignmentFormData, endDate: event.target.value })}
                  className={formErrors.endDate ? 'input-error' : ''}
                />
                {formErrors.endDate && <span className="field-error">{formErrors.endDate}</span>}
              </div>
            </>
          )}
          <div className="form-field">
            <label htmlFor="mission-deliverables">{t('dashboard.form.deliverables')}</label>
            <textarea
              id="mission-deliverables"
              value={missionFormData.deliverables}
              onChange={(event) => setMissionFormData({ ...missionFormData, deliverables: event.target.value })}
              rows={4}
              placeholder="One deliverable per line"
            />
          </div>
          {formErrors.submit && <p className="form-error">{formErrors.submit}</p>}
          <div className="modal-actions">
            <button type="button" className="button button-secondary button-sm" onClick={closeCreateMissionModal}>
              {t('dashboard.form.cancel')}
            </button>
            <button type="submit" className="button button-primary button-sm">
              {t('dashboard.form.save')}
            </button>
          </div>
        </form>
      </Modal>
      <Modal isOpen={isAddMeetingModalOpen} onClose={() => setIsAddMeetingModalOpen(false)} title={t('dashboard.supervisor.addMeeting')}>
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); void handleAddMeeting() }}>
          <div className="form-field">
            <label htmlFor="meeting-intern">{t('dashboard.form.intern')}</label>
            <select
              id="meeting-intern"
              value={meetingFormData.internId}
              onChange={(event) => setMeetingFormData({ ...meetingFormData, internId: event.target.value })}
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
              onChange={(event) => setMeetingFormData({ ...meetingFormData, date: event.target.value })}
              className={formErrors.date ? 'input-error' : ''}
            />
            {formErrors.date && <span className="field-error">{formErrors.date}</span>}
          </div>
          <div className="form-field">
            <label htmlFor="meeting-note">{t('dashboard.form.note')}</label>
            <textarea
              id="meeting-note"
              value={meetingFormData.note}
              onChange={(event) => setMeetingFormData({ ...meetingFormData, note: event.target.value })}
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
              onChange={(event) => setValidationComment(event.target.value)}
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
      <Modal isOpen={isEvaluationModalOpen} onClose={() => setIsEvaluationModalOpen(false)} title={selectedEvaluation?.internName ?? ''}>
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); void handleSubmitEvaluation() }}>
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
                onChange={(event) => setEvaluationScores({
                  ...evaluationScores,
                  [criterion.key]: parseInt(event.target.value, 10),
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
              onChange={(event) => setEvaluationScores({ ...evaluationScores, comments: event.target.value })}
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

import { Modal } from '../components/Modal'
import {
  DeliverablesCard,
  EvaluationCard,
  JournalCard,
  MeetingCard,
  MissionCard,
  QuickStatsCard,
  TasksCard,
} from '../components/intern/InternDashboardCards'
import {
  IncompleteStatusView,
  StatusGateLoading,
} from '../components/intern/InternStatusViews'
import { MultiStepApplicationForm } from '../components/intern/MultiStepApplicationForm'
import { useInternDashboard } from '../hooks/intern/useInternDashboard'
import '../styles/pages/InternDashboard.css'

export function InternDashboard() {
  const {
    t,
    user,
    fileInputRef,

    internship,
    tasks,
    deliverables,
    journalEntries,
    evaluations,
    nextMeeting,
    meetingsCount,
    internLifecycleStatus,

    isJournalModalOpen,
    journalContent,
    commentModalDeliverable,

    loadingInternship,
    loadingTasks,
    loadingDeliverables,
    loadingJournal,
    loadingEvaluations,
    loadingMeeting,
    loadingMeetingsCount,
    statusLoading,

    internshipError,
    tasksError,
    deliverablesError,
    journalError,
    evaluationsError,
    meetingError,
    statusError,
    formError,

    setIsJournalModalOpen,
    setJournalContent,
    setCommentModalDeliverable,

    loadInternLifecycleStatus,
    loadInternship,
    loadTasks,
    loadDeliverables,
    loadJournal,
    loadEvaluations,
    loadNextMeeting,

    handleCompleteTask,
    handleAddJournalEntry,
    handleUploadClick,
    handleHiddenFileChange,
    handleCvUploaded,

    getUserInitials,
    getFirstName,
  } = useInternDashboard()

  if (statusLoading) {
    return <StatusGateLoading />
  }

  if (statusError) {
    return (
      <div className="intern-dashboard status-gate-page">
        <div className="status-gate-card">
          <h1 className="status-gate-title">Unable to load your status</h1>
          <p className="status-gate-subtitle">{statusError}</p>
          <button className="error-retry-btn" onClick={() => { void loadInternLifecycleStatus() }}>Retry</button>
        </div>
      </div>
    )
  }

  if (!user?.id) {
    return (
      <div className="intern-dashboard status-gate-page">
        <div className="status-gate-card">
          <h1 className="status-gate-title">Unable to load your profile</h1>
        </div>
      </div>
    )
  }

  if (internLifecycleStatus === 'INCOMPLETE') {
    return <IncompleteStatusView internId={user.id} onUploaded={handleCvUploaded} />
  }

  if (internLifecycleStatus === 'PENDING') {
    return (
      <MultiStepApplicationForm
        internId={user.id}
        onSubmitted={() => {
          // Refresh the lifecycle status after form submission
          loadInternLifecycleStatus()
        }}
      />
    )
  }

  if (internLifecycleStatus === 'COMPLETED' || internLifecycleStatus === 'ARCHIVED') {
    return (
      <div className="intern-dashboard status-gate-page">
        <div className="status-gate-card">
          <h1 className="status-gate-title">Internship status: {internLifecycleStatus}</h1>
          <p className="status-gate-subtitle">This dashboard is currently in read-only mode for your lifecycle state.</p>
        </div>
      </div>
    )
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

      <button
        className="fab-button"
        onClick={() => setIsJournalModalOpen(true)}
        aria-label="Add journal entry"
      >
        +
      </button>

      <Modal isOpen={isJournalModalOpen} onClose={() => setIsJournalModalOpen(false)} title={t('dashboard.intern.addEntry')}>
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); void handleAddJournalEntry() }}>
          <div className="form-field">
            <textarea
              value={journalContent}
              onChange={(event) => setJournalContent(event.target.value)}
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
        className="intern-hidden-file-input"
        onChange={handleHiddenFileChange}
      />
    </div>
  )
}

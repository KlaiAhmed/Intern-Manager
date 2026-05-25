import { useEffect } from 'react'
import { Modal } from '../components/Modal'
import { FeatureGate } from '../components/intern/FeatureGate'
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
  PendingStatusView,
  StatusGateLoading,
} from '../components/intern/InternStatusViews'
import { MultiStepApplicationForm } from '../components/intern/MultiStepApplicationForm'
import { useInternDashboard } from '../hooks/intern/useInternDashboard'
import { useMissionFeatureFlags } from '../hooks/intern/useMissionFeatureFlags'
import type { DashboardCard } from '../types/missionFeatureFlags'
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
    pendingNotificationMessage,
    pendingProfile,

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

    getUserInitials,
    getFirstName,
  } = useInternDashboard()

  const missionIdForFlags = internLifecycleStatus === 'ACTIVE' ? internship?.id ?? null : null
  const { flags: missionFlags } = useMissionFeatureFlags(missionIdForFlags)

  const isCardReadOnly = (card: DashboardCard) => Boolean(missionFlags?.[card] && !missionFlags[card].isInteractive)
  const isJournalVisible = missionFlags?.journal?.isVisible ?? true
  const isJournalReadOnly = isCardReadOnly('journal')

  const openJournalModal = () => {
    if (!isJournalVisible || isJournalReadOnly) {
      return
    }

    setIsJournalModalOpen(true)
  }

  useEffect(() => {
    if (isJournalModalOpen && (!isJournalVisible || isJournalReadOnly)) {
      setIsJournalModalOpen(false)
    }
  }, [isJournalModalOpen, isJournalReadOnly, isJournalVisible, setIsJournalModalOpen])

  if (statusLoading) {
    return <StatusGateLoading />
  }

  if (statusError) {
    return (
      <div className="intern-dashboard status-gate-page">
        <div className="status-gate-card">
          <h1 className="status-gate-title">{t('dashboard.internDashboard.unableLoadStatus')}</h1>
          <p className="status-gate-subtitle">{statusError}</p>
          <button className="error-retry-btn" onClick={() => { void loadInternLifecycleStatus() }}>{t('dashboard.internDashboard.retry')}</button>
        </div>
      </div>
    )
  }

  if (!user?.id) {
    return (
      <div className="intern-dashboard status-gate-page">
        <div className="status-gate-card">
          <h1 className="status-gate-title">{t('dashboard.internDashboard.unableLoadProfile')}</h1>
        </div>
      </div>
    )
  }

  if (internLifecycleStatus === 'INCOMPLETE') {
    return (
      <MultiStepApplicationForm
        onSubmitted={() => {
          // Refresh the lifecycle status after form submission
          loadInternLifecycleStatus()
        }}
      />
    )
  }

  if (internLifecycleStatus === 'PENDING') {
    return <PendingStatusView notificationMessage={pendingNotificationMessage} profile={pendingProfile} />
  }

  if (internLifecycleStatus === 'COMPLETED' || internLifecycleStatus === 'ARCHIVED') {
    return (
      <div className="intern-dashboard status-gate-page">
        <div className="status-gate-card">
          <h1 className="status-gate-title">{t('dashboard.internDashboard.internshipStatus', { status: internLifecycleStatus })}</h1>
          <p className="status-gate-subtitle">{t('dashboard.internDashboard.readOnly')}</p>
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
            <h1 className="intern-greeting">{t('dashboard.internDashboard.welcomeBack', { name: getFirstName() ? `, ${getFirstName()}` : '' })}</h1>
            <p className="intern-greeting-sub">{t('dashboard.internDashboard.overviewSubtitle')}</p>
          </div>
        </div>
      </header>

      <div className="intern-grid">
        {/* Mission card alone on first row */}
        <FeatureGate card="missionOverview" flags={missionFlags}>
          <MissionCard
            internship={internship}
            loading={loadingInternship}
            error={internshipError}
            onRetry={loadInternship}
            t={t}
          />
        </FeatureGate>

        {/* Quick Stats + Tasks row */}
        <div className="intern-row">
          <FeatureGate card="quickStats" flags={missionFlags}>
            <QuickStatsCard
              tasks={tasks}
              deliverables={deliverables}
              internship={internship}
              meetingsCount={meetingsCount}
              loading={loadingInternship || loadingTasks || loadingDeliverables || loadingMeetingsCount}
              t={t}
            />
          </FeatureGate>

          <FeatureGate card="tasks" flags={missionFlags}>
            <TasksCard
              tasks={tasks}
              loading={loadingTasks}
              error={tasksError}
              onRetry={loadTasks}
              onComplete={handleCompleteTask}
              isReadOnly={isCardReadOnly('tasks')}
              t={t}
            />
          </FeatureGate>
        </div>

        {/* Deliverables + Evaluation row */}
        <div className="intern-row">
          <FeatureGate card="deliverables" flags={missionFlags}>
            <DeliverablesCard
              deliverables={deliverables}
              loading={loadingDeliverables}
              error={deliverablesError}
              onRetry={loadDeliverables}
              onUploadClick={handleUploadClick}
              onViewComment={setCommentModalDeliverable}
              isReadOnly={isCardReadOnly('deliverables')}
              t={t}
            />
          </FeatureGate>

          <FeatureGate card="evaluation" flags={missionFlags}>
            <EvaluationCard
              evaluations={evaluations}
              loading={loadingEvaluations}
              error={evaluationsError}
              onRetry={loadEvaluations}
              t={t}
            />
          </FeatureGate>
        </div>

        {/* Journal + Meeting row */}
        <div className="intern-row">
          <FeatureGate card="journal" flags={missionFlags}>
            <JournalCard
              entries={journalEntries}
              loading={loadingJournal}
              error={journalError}
              onRetry={loadJournal}
              onAddClick={openJournalModal}
              isReadOnly={isJournalReadOnly}
              t={t}
            />
          </FeatureGate>

          <FeatureGate card="meeting" flags={missionFlags}>
            <MeetingCard
              meeting={nextMeeting}
              loading={loadingMeeting}
              error={meetingError}
              onRetry={loadNextMeeting}
              t={t}
            />
          </FeatureGate>
        </div>
      </div>

      {isJournalVisible && (
        <button
          className="fab-button"
          onClick={openJournalModal}
          disabled={isJournalReadOnly}
          aria-label={t('dashboard.internDashboard.addJournalEntry')}
        >
          +
        </button>
      )}

      <Modal isOpen={isJournalModalOpen} onClose={() => setIsJournalModalOpen(false)} title={t('dashboard.intern.addEntry')}>
        <form
          className="modal-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (isJournalReadOnly || !isJournalVisible) {
              return
            }
            void handleAddJournalEntry()
          }}
        >
          <div className="form-field">
            <textarea
              value={journalContent}
              onChange={(event) => setJournalContent(event.target.value)}
              rows={6}
              placeholder={t('dashboard.form.description')}
              disabled={isJournalReadOnly || !isJournalVisible}
              className={formError ? 'input-error' : ''}
            />
            {isJournalReadOnly && (
              <span className="card-readonly-hint">{t('dashboard.internDashboard.journalReadOnly')}</span>
            )}
            {formError && <span className="field-error">{formError}</span>}
          </div>
          <div className="modal-actions">
            <button type="button" className="button button-secondary button-sm" onClick={() => setIsJournalModalOpen(false)}>
              {t('dashboard.form.cancel')}
            </button>
            <button type="submit" className="button button-primary button-sm" disabled={isJournalReadOnly || !isJournalVisible}>
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

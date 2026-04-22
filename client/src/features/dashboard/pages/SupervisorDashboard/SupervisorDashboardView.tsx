import { DashboardButton } from '../../components/DashboardButton'
import { DashboardMetricCard } from '../../components/DashboardMetricCard'
import { EvaluationRow } from '../../components/EvaluationRow'
import { ErrorState } from '../../components/ErrorState'
import { MetricBar } from '../../components/MetricBar'
import { Modal } from '../../components/Modal'
import { Panel } from '../../components/Panel'
import { ProgressRow } from '../../components/ProgressRow'
import { Skeleton } from '../../components/Skeleton'
import { StatusBadge } from '../../components/StatusBadge'
import { ValidationQueueItem } from '../../components/ValidationQueueItem'
import { SupervisorMeetingForm } from '../../components/supervisor/SupervisorMeetingForm'
import { TaskAssignmentForm } from '../../components/supervisor/TaskAssignmentForm'
import { DeliverableAssignmentForm } from '../../components/supervisor/DeliverableAssignmentForm'
import { useSupervisorDashboardState } from './useSupervisorDashboardState'

interface SupervisorDashboardViewProps {
  state: ReturnType<typeof useSupervisorDashboardState>
}

function formatDate(dateValue: string | null): string {
  if (!dateValue) {
    return '-'
  }

  const parsedDate = new Date(dateValue)
  if (Number.isNaN(parsedDate.getTime())) {
    return dateValue
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parsedDate)
}

function formatDateTime(dateValue: string): string {
  const parsedDate = new Date(dateValue)
  if (Number.isNaN(parsedDate.getTime())) {
    return dateValue
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsedDate)
}

export function SupervisorDashboardView({ state }: SupervisorDashboardViewProps) {
  const {
    t,
    refreshAll,
    isRefreshing,
    kpisState,
    progressState,
    progressItems,
    workloadState,
    delaysState,
    delayAlerts,
    queueState,
    meetingsState,
    evaluationsState,
    internOptions,
    meetingForm,
    meetingFormError,
    updateMeetingFormField,
    submitMeetingForm,
    taskForm,
    taskFormError,
    updateTaskFormField,
    submitTaskForm,
    deliverableForm,
    deliverableFormError,
    updateDeliverableFormField,
    submitDeliverableForm,
    openInternProfile,
    resolveDelaySeverityLabel,
    resolveDelaySeverityTone,
    resolveEvaluationTypeLabel,
    handleQueueAccept,
    handleQueueReject,
    activeEvaluation,
    evaluationScores,
    evaluationComment,
    setEvaluationComment,
    setEvaluationScore,
    openEvaluationModal,
    closeEvaluationModal,
    submitEvaluation,
  } = state

  const workload = workloadState.workload
  const workloadTone =
    workload.utilizationPercent !== null && workload.utilizationPercent >= 90
      ? 'danger'
      : workload.utilizationPercent !== null && workload.utilizationPercent >= 75
        ? 'warning'
        : 'safe'

  const internTypeTotal = workload.pfeCount + workload.summerCount + workload.otherCount
  const pfeRatio = internTypeTotal > 0 ? Math.round((workload.pfeCount / internTypeTotal) * 100) : 0
  const summerRatio = internTypeTotal > 0 ? Math.round((workload.summerCount / internTypeTotal) * 100) : 0
  const otherRatio = internTypeTotal > 0 ? Math.max(0, 100 - pfeRatio - summerRatio) : 0

  return (
    <div className="dashboard-container supervisor-dashboard">
      <header className="supervisor-header">
        <div>
          <h1 className="dashboard-title">{t('dashboard.supervisor.title')}</h1>
          <p className="supervisor-subtitle">{t('dashboard.supervisor.subtitle')}</p>
        </div>

        <div className="supervisor-header-actions">
          <DashboardButton
            variant="secondary"
            size="sm"
            disabled={isRefreshing}
            onClick={() => {
              void refreshAll()
            }}
          >
            {t('dashboard.action.refresh')}
          </DashboardButton>
        </div>
      </header>

      <section className="supervisor-kpi-row">
        {kpisState.isLoading ? (
          <>
            <Skeleton height="132px" />
            <Skeleton height="132px" />
            <Skeleton height="132px" />
            <Skeleton height="132px" />
          </>
        ) : kpisState.error ? (
          <div className="supervisor-wide-state">
            <ErrorState message={kpisState.error} onRetry={() => { void kpisState.refresh() }} />
          </div>
        ) : (
          <>
            <DashboardMetricCard
              label={t('dashboard.kpi.myActiveInterns')}
              value={kpisState.kpis.activeInterns}
              variant="primary"
              animationDelay={0}
            />
            <DashboardMetricCard
              label={t('dashboard.kpi.pendingValidations')}
              value={kpisState.kpis.pendingDeliverables}
              variant="warning"
              highlight={kpisState.kpis.pendingDeliverables > 0 ? 'warning' : 'none'}
              animationDelay={60}
            />
            <DashboardMetricCard
              label={t('dashboard.kpi.overdueInterns')}
              value={kpisState.kpis.internsBehind}
              variant="default"
              highlight={kpisState.kpis.internsBehind > 0 ? 'danger' : 'none'}
              animationDelay={120}
            />
            <DashboardMetricCard
              label={t('dashboard.supervisor.kpi.avgValidationDelay')}
              value={`${kpisState.kpis.avgValidationDelayDays.toFixed(1)}d`}
              subtitle={`${kpisState.kpis.validationDelaySampleSize} ${t('dashboard.supervisor.kpi.samples')}`}
              variant="default"
              animationDelay={180}
            />
          </>
        )}
      </section>

       <div className="supervisor-two-column">
         <Panel
           title={t('dashboard.supervisor.myInterns')}
           actions={
             <div className="supervisor-panel-actions">
               <TaskAssignmentForm
                 internOptions={internOptions}
                 taskForm={taskForm}
                 taskFormError={taskFormError}
                 submitError={null}
                 isSubmitting={false}
                 onFieldChange={updateTaskFormField}
                 onSubmit={submitTaskForm}
               />
               <DashboardButton variant="ghost" size="sm" onClick={() => { void progressState.refresh() }}>
                 {t('dashboard.action.refresh')}
               </DashboardButton>
             </div>
           }
           className="supervisor-panel"
         >
          {progressState.isLoading ? (
            <div className="supervisor-list-skeletons">
              <Skeleton height="90px" />
              <Skeleton height="90px" />
              <Skeleton height="90px" />
            </div>
          ) : progressState.error ? (
            <ErrorState message={progressState.error} onRetry={() => { void progressState.refresh() }} />
          ) : progressItems.length === 0 ? (
            <div className="supervisor-empty-state">{t('dashboard.noData')}</div>
          ) : (
            <div>
              {progressItems.map((item) => (
                <ProgressRow
                  key={item.internId}
                  name={item.fullName}
                  missionTitle={item.missionTitle || t('dashboard.noData')}
                  stageType={item.stageType || t('dashboard.noData')}
                  progress={item.progress}
                  statusLabel={item.statusLabel}
                  tone={item.tone}
                  onSelect={() => openInternProfile(item.internId)}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title={t('dashboard.supervisor.workload.title')}
          actions={
            <DashboardButton variant="ghost" size="sm" onClick={() => { void workloadState.refresh() }}>
              {t('dashboard.action.refresh')}
            </DashboardButton>
          }
          className="supervisor-panel"
        >
          {workloadState.isLoading ? (
            <div className="supervisor-list-skeletons">
              <Skeleton height="116px" />
              <Skeleton height="116px" />
            </div>
          ) : workloadState.error ? (
            <ErrorState message={workloadState.error} onRetry={() => { void workloadState.refresh() }} />
          ) : (
            <div className="supervisor-workload-stack">
              <MetricBar
                label={t('dashboard.supervisor.workload.capacityLabel')}
                subtitle={
                  workload.utilizationPercent !== null
                    ? `${workload.utilizationPercent}% ${t('dashboard.supervisor.workload.utilization')}`
                    : t('dashboard.supervisor.workload.capacityUnknown')
                }
                current={workload.currentInternCount}
                maximum={workload.maxCapacity}
                tone={workloadTone}
              />

              <ul className="supervisor-workload-breakdown">
                <li>
                  <span>{t('dashboard.supervisor.workload.pfe')}</span>
                  <strong>
                    {workload.pfeCount} ({pfeRatio}%)
                  </strong>
                </li>
                <li>
                  <span>{t('dashboard.supervisor.workload.summer')}</span>
                  <strong>
                    {workload.summerCount} ({summerRatio}%)
                  </strong>
                </li>
                <li>
                  <span>{t('dashboard.supervisor.workload.other')}</span>
                  <strong>
                    {workload.otherCount} ({otherRatio}%)
                  </strong>
                </li>
              </ul>
            </div>
          )}
        </Panel>
      </div>

      <div className="supervisor-two-column">
        <Panel
          title={t('dashboard.supervisor.delays.title')}
          actions={
            <DashboardButton variant="ghost" size="sm" onClick={() => { void delaysState.refresh() }}>
              {t('dashboard.action.refresh')}
            </DashboardButton>
          }
          className="supervisor-panel"
        >
          {delaysState.isLoading ? (
            <div className="supervisor-list-skeletons">
              <Skeleton height="94px" />
              <Skeleton height="94px" />
            </div>
          ) : delaysState.error ? (
            <ErrorState message={delaysState.error} onRetry={() => { void delaysState.refresh() }} />
          ) : delayAlerts.length === 0 ? (
            <div className="supervisor-empty-state">{t('dashboard.noData')}</div>
          ) : (
            <div className="supervisor-delay-list">
              {delayAlerts.map((alert) => (
                <article key={alert.deliverableId} className="supervisor-delay-item">
                  <div>
                    <h3 className="supervisor-delay-title">{alert.deliverableTitle}</h3>
                    <p className="supervisor-delay-intern">{alert.internName}</p>
                    <p className="supervisor-delay-date">
                      {t('dashboard.table.dueDate')}: {formatDate(alert.dueDate)}
                    </p>
                  </div>

                  <div className="supervisor-delay-side">
                    <StatusBadge
                      label={resolveDelaySeverityLabel(alert.severity)}
                      tone={resolveDelaySeverityTone(alert.severity)}
                      size="sm"
                    />
                    <p className="supervisor-delay-overdue">
                      {alert.daysOverdue} {t('dashboard.supervisor.delays.daysOverdue')}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>

         <Panel
           title={`${t('dashboard.supervisor.pendingDeliverables')} (${queueState.total})`}
           actions={
             <div className="supervisor-panel-actions">
                 <DeliverableAssignmentForm
                   internOptions={internOptions}
                   missionOptions={progressItems.filter(item => item.missionId).map(item => ({ id: item.missionId!, title: item.missionTitle || t('dashboard.noData') }))}
                   deliverableForm={deliverableForm}
                   deliverableFormError={deliverableFormError}
                   submitError={null}
                   isSubmitting={false}
                   onFieldChange={updateDeliverableFormField}
                   onSubmit={submitDeliverableForm}
                 />
               <DashboardButton variant="ghost" size="sm" onClick={() => { void queueState.refresh() }}>
                 {t('dashboard.action.refresh')}
               </DashboardButton>
             </div>
           }
           className="supervisor-panel"
         >
          {queueState.isLoading ? (
            <div className="supervisor-list-skeletons">
              <Skeleton height="120px" />
              <Skeleton height="120px" />
            </div>
          ) : queueState.error ? (
            <ErrorState message={queueState.error} onRetry={() => { void queueState.refresh() }} />
          ) : queueState.items.length === 0 ? (
            <div className="supervisor-empty-state">{t('dashboard.noData')}</div>
          ) : (
            <div>
              {queueState.items.map((item) => (
                <ValidationQueueItem
                  key={item.id}
                  item={item}
                  isSubmitting={queueState.submittingItemId === item.id}
                  openFileLabel={t('dashboard.supervisor.queue.openFile')}
                  submittedOnLabel={t('dashboard.table.submittedDate')}
                  dueOnLabel={t('dashboard.table.dueDate')}
                  versionLabel={t('dashboard.table.version')}
                  acceptLabel={t('dashboard.supervisor.accept')}
                  rejectLabel={t('dashboard.supervisor.reject')}
                  rejectReasonLabel={t('dashboard.supervisor.queue.rejectReason')}
                  rejectReasonPlaceholder={t('dashboard.supervisor.queue.rejectReasonPlaceholder')}
                  rejectSubmitLabel={t('dashboard.supervisor.queue.rejectSubmit')}
                  cancelLabel={t('dashboard.form.cancel')}
                  onAccept={handleQueueAccept}
                  onReject={handleQueueReject}
                />
              ))}
            </div>
          )}

          {queueState.actionError && <p className="form-error supervisor-inline-error">{queueState.actionError}</p>}
        </Panel>
      </div>

      <div className="supervisor-two-column">
        <Panel
          title={t('dashboard.supervisor.meetings')}
          actions={
            <DashboardButton variant="ghost" size="sm" onClick={() => { void meetingsState.refresh() }}>
              {t('dashboard.action.refresh')}
            </DashboardButton>
          }
          className="supervisor-panel"
        >
          <div className="supervisor-meetings-layout">
            <div>
              <h3 className="supervisor-subpanel-title">{t('dashboard.supervisor.meetings.upcoming')}</h3>
              {meetingsState.isLoading ? (
                <div className="supervisor-list-skeletons">
                  <Skeleton height="80px" />
                  <Skeleton height="80px" />
                </div>
              ) : meetingsState.error ? (
                <ErrorState message={meetingsState.error} onRetry={() => { void meetingsState.refresh() }} />
              ) : meetingsState.meetings.length === 0 ? (
                <div className="supervisor-empty-state">{t('dashboard.noData')}</div>
              ) : (
                <ul className="supervisor-meeting-list">
                  {meetingsState.meetings.map((meeting) => (
                    <li key={meeting.id} className="supervisor-meeting-item">
                      <h4>{meeting.internName}</h4>
                      <time dateTime={meeting.date}>{formatDateTime(meeting.date)}</time>
                      {meeting.notes && <p>{meeting.notes}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <SupervisorMeetingForm
              internOptions={internOptions}
              meetingForm={meetingForm}
              meetingFormError={meetingFormError}
              submitError={meetingsState.submitError}
              isSubmitting={meetingsState.isSubmitting}
              onFieldChange={updateMeetingFormField}
              onSubmit={submitMeetingForm}
            />
          </div>
        </Panel>

        <Panel
          title={t('dashboard.supervisor.evaluationsDue')}
          actions={
            <DashboardButton variant="ghost" size="sm" onClick={() => { void evaluationsState.refresh() }}>
              {t('dashboard.action.refresh')}
            </DashboardButton>
          }
          className="supervisor-panel"
        >
          <div className="supervisor-evaluations-layout">
            <div>
              <h3 className="supervisor-subpanel-title">
                {t('dashboard.supervisor.evaluations.due')} ({evaluationsState.status.due.length})
              </h3>

              {evaluationsState.isLoading ? (
                <div className="supervisor-list-skeletons">
                  <Skeleton height="82px" />
                  <Skeleton height="82px" />
                </div>
              ) : evaluationsState.error ? (
                <ErrorState message={evaluationsState.error} onRetry={() => { void evaluationsState.refresh() }} />
              ) : evaluationsState.status.due.length === 0 ? (
                <div className="supervisor-empty-state">{t('dashboard.noData')}</div>
              ) : (
                <div>
                  {evaluationsState.status.due.map((item) => (
                    <EvaluationRow
                      key={item.evaluationId}
                      mode="due"
                      internName={item.internName}
                      typeLabel={resolveEvaluationTypeLabel(item.type)}
                      badgeLabel={t('dashboard.supervisor.evaluations.badgeDue')}
                      actionLabel={t('dashboard.supervisor.evaluate')}
                      onAction={() => openEvaluationModal(item)}
                      isActionDisabled={evaluationsState.isSubmitting}
                    />
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="supervisor-subpanel-title">
                {t('dashboard.supervisor.evaluations.completed')} ({evaluationsState.status.completed.length})
              </h3>

              {evaluationsState.isLoading ? (
                <div className="supervisor-list-skeletons">
                  <Skeleton height="82px" />
                  <Skeleton height="82px" />
                </div>
              ) : evaluationsState.status.completed.length === 0 ? (
                <div className="supervisor-empty-state">{t('dashboard.noData')}</div>
              ) : (
                <div>
                  {evaluationsState.status.completed.map((item) => (
                    <EvaluationRow
                      key={item.evaluationId}
                      mode="completed"
                      internName={item.internName}
                      typeLabel={resolveEvaluationTypeLabel(item.type)}
                      badgeLabel={t('dashboard.supervisor.evaluations.badgeCompleted')}
                      averageScoreLabel={t('dashboard.evaluation.score')}
                      averageScore={item.averageScore}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </Panel>
      </div>

      <Modal
        isOpen={Boolean(activeEvaluation)}
        onClose={closeEvaluationModal}
        title={activeEvaluation ? `${activeEvaluation.internName} - ${t('dashboard.supervisor.evaluate')}` : t('dashboard.supervisor.evaluate')}
      >
        <form
          className="modal-form supervisor-evaluation-form"
          onSubmit={(event) => {
            event.preventDefault()
            void submitEvaluation()
          }}
        >
          <p className="supervisor-evaluation-type">
            {activeEvaluation ? resolveEvaluationTypeLabel(activeEvaluation.type) : ''}
          </p>

          {[
            { key: 'technical', label: t('dashboard.evaluation.technical') },
            { key: 'autonomy', label: t('dashboard.evaluation.autonomy') },
            { key: 'communication', label: t('dashboard.evaluation.communication') },
            { key: 'deadlineRespect', label: t('dashboard.evaluation.deadlineRespect') },
            { key: 'deliverableQuality', label: t('dashboard.evaluation.deliverableQuality') },
          ].map((criterion) => {
            const criterionKey = criterion.key as keyof typeof evaluationScores

            return (
              <div key={criterion.key} className="supervisor-evaluation-criterion">
                <label htmlFor={`criterion-${criterion.key}`}>{criterion.label}</label>
                <div className="supervisor-evaluation-criterion-input">
                  <input
                    id={`criterion-${criterion.key}`}
                    type="range"
                    min={0}
                    max={10}
                    value={evaluationScores[criterionKey]}
                    onChange={(event) => {
                      setEvaluationScore(criterionKey, Number.parseInt(event.target.value, 10))
                    }}
                    disabled={evaluationsState.isSubmitting}
                  />
                  <span>{evaluationScores[criterionKey]}/10</span>
                </div>
              </div>
            )
          })}

          <div className="form-field">
            <label htmlFor="evaluation-comment">{t('dashboard.evaluation.comments')}</label>
            <textarea
              id="evaluation-comment"
              value={evaluationComment}
              onChange={(event) => setEvaluationComment(event.target.value)}
              rows={4}
              disabled={evaluationsState.isSubmitting}
            />
          </div>

          {evaluationsState.submitError && <p className="form-error">{evaluationsState.submitError}</p>}

          <div className="modal-actions">
            <DashboardButton type="button" variant="secondary" size="sm" onClick={closeEvaluationModal}>
              {t('dashboard.form.cancel')}
            </DashboardButton>
            <DashboardButton type="submit" variant="primary" size="sm" loading={evaluationsState.isSubmitting}>
              {t('dashboard.form.submit')}
            </DashboardButton>
          </div>
        </form>
      </Modal>
    </div>
  )
}
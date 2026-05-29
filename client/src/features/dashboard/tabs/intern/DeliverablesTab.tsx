import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { DashboardButton } from '../../components/DashboardButton'
import { useInternDeliverableVersions, useInternDeliverables } from '../../hooks/intern/useInternDeliverables'
import { useInternTasks } from '../../hooks/intern/useInternTasks'
import { toErrorMessage } from '../../shared/utils/errorMessage'
import type { InternDeliverableResponse, InternTaskResponse } from '../../types/intern.types'
import type { TranslateFn } from '../../types/internDashboard'
import {
  applyOptimisticTaskCompletion,
  isAllowedSubmissionFile,
  isValidGitHubRepositoryUrl,
} from './deliverablesTabLogic'
import { InternTabEmpty, InternTabError, InternTabLoading } from './InternTabStates'

interface DeliverablesTabProps {
  tasksVisible: boolean
  deliverablesVisible: boolean
  tasksReadOnly: boolean
  deliverablesReadOnly: boolean
  t: TranslateFn
}

type SubmissionMode = 'file' | 'github'

const maxSubmissionBytes = 10 * 1024 * 1024

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function getStatusLabel(deliverable: InternDeliverableResponse, t: TranslateFn): string {
  return t(`dashboard.intern.deliverables.status.${deliverable.status}`)
}

export function DeliverablesTab({
  tasksVisible,
  deliverablesVisible,
  tasksReadOnly,
  deliverablesReadOnly,
  t,
}: DeliverablesTabProps) {
  const tasksState = useInternTasks({ enabled: tasksVisible })
  const deliverablesState = useInternDeliverables({ enabled: deliverablesVisible })
  const [optimisticTasks, setOptimisticTasks] = useState<InternTaskResponse[] | null>(null)
  const [pendingTaskIds, setPendingTaskIds] = useState<Set<string>>(() => new Set())
  const [taskError, setTaskError] = useState<string | null>(null)
  const [selectedDeliverable, setSelectedDeliverable] = useState<InternDeliverableResponse | null>(null)
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>('file')
  const [submissionFile, setSubmissionFile] = useState<File | null>(null)
  const [githubUrl, setGithubUrl] = useState('')
  const [githubBranch, setGithubBranch] = useState('')
  const [submissionMessage, setSubmissionMessage] = useState('')
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [historyDeliverable, setHistoryDeliverable] = useState<InternDeliverableResponse | null>(null)

  const historyQuery = useInternDeliverableVersions(historyDeliverable?.id, {
    enabled: Boolean(historyDeliverable),
  })

  const visibleTasks = optimisticTasks ?? tasksState.tasks
  const isLoading = tasksState.isLoading || deliverablesState.isLoading
  const loadError = tasksState.tasksQuery.error ?? deliverablesState.deliverablesQuery.error
  const hasContent = visibleTasks.length > 0 || deliverablesState.deliverables.length > 0

  const completeTask = async (taskId: string) => {
    const previousTasks = visibleTasks
    setTaskError(null)
    setOptimisticTasks(applyOptimisticTaskCompletion(previousTasks, taskId))
    setPendingTaskIds((currentIds) => new Set(currentIds).add(taskId))

    try {
      await tasksState.completeTask(taskId)
    } catch (error) {
      setOptimisticTasks(previousTasks)
      setTaskError(toErrorMessage(error, t('dashboard.intern.deliverables.completeFailed')))
    } finally {
      setPendingTaskIds((currentIds) => {
        const nextIds = new Set(currentIds)
        nextIds.delete(taskId)
        return nextIds
      })
    }
  }

  const openSubmitModal = (deliverable: InternDeliverableResponse) => {
    setSelectedDeliverable(deliverable)
    setSubmissionMode('file')
    setSubmissionFile(null)
    setGithubUrl('')
    setGithubBranch('')
    setSubmissionMessage('')
    setSubmissionError(null)
  }

  const closeSubmitModal = () => {
    if (!deliverablesState.isUploading) {
      setSelectedDeliverable(null)
      setSubmissionError(null)
    }
  }

  const submitWork = async () => {
    if (!selectedDeliverable) {
      return
    }

    if (submissionMode === 'file') {
      if (!submissionFile) {
        setSubmissionError(t('dashboard.intern.deliverables.fileRequired'))
        return
      }

      if (!isAllowedSubmissionFile(submissionFile)) {
        setSubmissionError(t('dashboard.intern.upload.error.fileType'))
        return
      }

      if (submissionFile.size > maxSubmissionBytes) {
        setSubmissionError(t('dashboard.intern.upload.error.fileSize'))
        return
      }
    }

    if (submissionMode === 'github' && !isValidGitHubRepositoryUrl(githubUrl)) {
      setSubmissionError(t('dashboard.intern.deliverables.githubInvalid'))
      return
    }

    setSubmissionError(null)
    try {
      await deliverablesState.submitVersion({
        deliverableId: selectedDeliverable.id,
        file: submissionMode === 'file' ? submissionFile : null,
        gitHubUrl: submissionMode === 'github' ? githubUrl.trim() : null,
        gitHubBranch: submissionMode === 'github' ? githubBranch.trim() || null : null,
        message: submissionMessage.trim() || null,
      })
      setSelectedDeliverable(null)
      setOptimisticTasks(null)
    } catch (error) {
      setSubmissionError(toErrorMessage(error, t('dashboard.intern.upload.error.generic')))
    }
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSubmissionFile(event.target.files?.[0] ?? null)
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submitWork()
  }

  if (isLoading) {
    return <InternTabLoading label={t('dashboard.intern.tabs.loading')} />
  }

  if (loadError) {
    return (
      <InternTabError
        title={t('dashboard.intern.tabs.errorTitle')}
        message={toErrorMessage(loadError, t('dashboard.intern.tabs.errorMessage'))}
        retryLabel={t('dashboard.intern.error.retry')}
        onRetry={() => {
          void tasksState.refetch()
          void deliverablesState.refetch()
        }}
      />
    )
  }

  return (
    <>
      {!hasContent ? (
        <InternTabEmpty
          title={t('dashboard.intern.deliverables.emptyTitle')}
          message={t('dashboard.intern.deliverables.emptyMessage')}
        />
      ) : (
        <div className="intern-tab-stack">
          {tasksVisible && (
            <section className="intern-panel">
              <div className="intern-section-header">
                <div>
                  <p className="intern-eyebrow">{t('dashboard.intern.deliverables.taskChecklist')}</p>
                  <h2>{t('dashboard.intern.tabs.tasks')}</h2>
                </div>
              </div>

              {taskError && <p className="intern-inline-error">{taskError}</p>}

              {visibleTasks.length > 0 ? (
                <ul className="intern-check-list">
                  {visibleTasks.map((task) => {
                    const isPending = pendingTaskIds.has(task.id)
                    return (
                      <li key={task.id}>
                        <label className="intern-check-row">
                          <input
                            type="checkbox"
                            checked={task.completed}
                            disabled={task.completed || tasksReadOnly || isPending}
                            onChange={() => { void completeTask(task.id) }}
                          />
                          <span>
                            <strong>{task.title}</strong>
                            <small>{t('dashboard.intern.deliverables.due', { date: formatDate(task.dueDate) })}</small>
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="intern-muted">{t('dashboard.intern.deliverables.noTasks')}</p>
              )}
            </section>
          )}

          {deliverablesVisible && (
            <section className="intern-panel">
              <div className="intern-section-header">
                <div>
                  <p className="intern-eyebrow">{t('dashboard.intern.tabs.deliverables')}</p>
                  <h2>{t('dashboard.intern.deliverables.assignedWork')}</h2>
                </div>
              </div>

              {deliverablesState.deliverables.length > 0 ? (
                <div className="intern-deliverable-list">
                  {deliverablesState.deliverables.map((deliverable) => (
                    <article key={deliverable.id} className="intern-deliverable-row">
                      <div>
                        <div className="intern-row-title">
                          <h3>{deliverable.title}</h3>
                          <span className="intern-status-pill">{getStatusLabel(deliverable, t)}</span>
                        </div>
                        <p>{t('dashboard.intern.deliverables.due', { date: formatDate(deliverable.dueDate) })}</p>
                        <div className="intern-progress-track" aria-hidden="true">
                          <div className="intern-progress-fill" style={{ width: `${deliverable.progress}%` }} />
                        </div>
                      </div>
                      <div className="intern-row-actions">
                        <DashboardButton variant="secondary" size="sm" onClick={() => setHistoryDeliverable(deliverable)}>
                          {t('dashboard.intern.deliverables.versionHistory')}
                        </DashboardButton>
                        <DashboardButton
                          variant="primary"
                          size="sm"
                          disabled={deliverablesReadOnly}
                          onClick={() => openSubmitModal(deliverable)}
                        >
                          {t('dashboard.intern.deliverables.submitWork')}
                        </DashboardButton>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="intern-muted">{t('dashboard.intern.deliverables.noDeliverables')}</p>
              )}
            </section>
          )}
        </div>
      )}

      <Modal
        isOpen={Boolean(selectedDeliverable)}
        onClose={closeSubmitModal}
        title={selectedDeliverable?.title ?? t('dashboard.intern.deliverables.submitWork')}
      >
        <form className="modal-form intern-submit-form" onSubmit={handleSubmit}>
          <div className="intern-segmented-control" role="tablist" aria-label={t('dashboard.intern.deliverables.submissionType')}>
            <button type="button" role="tab" aria-selected={submissionMode === 'file'} className={submissionMode === 'file' ? 'is-active' : ''} onClick={() => setSubmissionMode('file')}>
              {t('dashboard.intern.deliverables.fileUpload')}
            </button>
            <button type="button" role="tab" aria-selected={submissionMode === 'github'} className={submissionMode === 'github' ? 'is-active' : ''} onClick={() => setSubmissionMode('github')}>
              {t('dashboard.intern.deliverables.githubUrl')}
            </button>
          </div>

          {submissionMode === 'file' ? (
            <label className="intern-form-field">
              <span>{t('dashboard.intern.upload.selectedFile')}</span>
              <input type="file" accept=".pdf,.doc,.docx,.zip" onChange={handleFileChange} />
              <small>{t('dashboard.intern.upload.acceptedTypes')}</small>
            </label>
          ) : (
            <>
              <label className="intern-form-field">
                <span>{t('dashboard.intern.deliverables.githubUrl')}</span>
                <input type="url" value={githubUrl} onChange={(event) => setGithubUrl(event.target.value)} placeholder="https://github.com/owner/repo" />
              </label>
              <label className="intern-form-field">
                <span>{t('dashboard.intern.deliverables.githubBranch')}</span>
                <input type="text" value={githubBranch} onChange={(event) => setGithubBranch(event.target.value)} />
              </label>
            </>
          )}

          <label className="intern-form-field">
            <span>{t('dashboard.intern.deliverables.message')}</span>
            <textarea rows={4} value={submissionMessage} onChange={(event) => setSubmissionMessage(event.target.value)} />
          </label>

          {deliverablesState.uploadProgress && (
            <div className="intern-upload-progress" role="status">
              <div className="intern-progress-track" aria-hidden="true">
                <div className="intern-progress-fill" style={{ width: `${deliverablesState.uploadProgress.percent ?? 0}%` }} />
              </div>
              <span>{t('dashboard.intern.upload.progress', { percent: deliverablesState.uploadProgress.percent ?? 0 })}</span>
            </div>
          )}

          {submissionError && <p className="intern-inline-error">{submissionError}</p>}

          <div className="modal-actions">
            <DashboardButton type="button" variant="secondary" size="sm" onClick={closeSubmitModal}>
              {t('dashboard.form.cancel')}
            </DashboardButton>
            <DashboardButton type="submit" variant="primary" size="sm" loading={deliverablesState.isUploading}>
              {t('dashboard.form.submit')}
            </DashboardButton>
          </div>
        </form>
      </Modal>

      {historyDeliverable && (
        <aside className="intern-drawer" aria-label={t('dashboard.intern.deliverables.versionHistory')}>
          <div className="intern-drawer-header">
            <div>
              <p className="intern-eyebrow">{t('dashboard.intern.deliverables.versionHistory')}</p>
              <h2>{historyDeliverable.title}</h2>
            </div>
            <button type="button" className="intern-icon-button" onClick={() => setHistoryDeliverable(null)}>
              {t('dashboard.form.close')}
            </button>
          </div>

          {historyQuery.isLoading && <InternTabLoading label={t('dashboard.intern.tabs.loading')} />}
          {historyQuery.error && (
            <InternTabError
              title={t('dashboard.intern.tabs.errorTitle')}
              message={toErrorMessage(historyQuery.error, t('dashboard.intern.deliverables.historyFailed'))}
              retryLabel={t('dashboard.intern.error.retry')}
              onRetry={historyQuery.refetch}
            />
          )}
          {historyQuery.data && (
            <ol className="intern-version-list">
              {historyQuery.data.versions.map((version) => (
                <li key={version.id}>
                  <strong>{t('dashboard.intern.deliverables.versionNumber', { version: version.versionNumber })}</strong>
                  <span>{formatDate(version.submittedAt)}</span>
                  {version.gitHubUrl && (
                    <a href={version.gitHubUrl} target="_blank" rel="noreferrer noopener">
                      {version.gitHubUrl}
                    </a>
                  )}
                  {version.fileUrl && <span>{t('dashboard.intern.deliverables.fileSubmission')}</span>}
                  {version.message && <p>{version.message}</p>}
                </li>
              ))}
            </ol>
          )}
        </aside>
      )}
    </>
  )
}

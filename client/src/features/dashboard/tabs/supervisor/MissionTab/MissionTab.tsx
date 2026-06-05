import { useMemo, useState, type ChangeEvent } from 'react'
import { format } from 'date-fns'

import { DashboardButton } from '@/features/dashboard/components/DashboardButton'
import { Download, Edit, Eye, Plus, Trash2 } from '@/features/dashboard/components/IconComponents'
import { ErrorState } from '@/features/dashboard/components/ErrorState'
import { Panel } from '@/features/dashboard/components/Panel'
import { Skeleton } from '@/features/dashboard/components/Skeleton'
import { StatusBadge } from '@/features/dashboard/components/StatusBadge'
import { Toast } from '@/features/dashboard/components/Toast/Toast'
import { useToast } from '@/features/dashboard/components/Toast/useToast'
import { clampProgress } from '@/features/dashboard/hooks/supervisor/utils'
import { getDeliverableStatusTone, getTaskPriority, getTaskStatusTone } from '@/features/dashboard/shared/utils/supervisorUtils'
import { TaskDrawer } from '@/features/dashboard/tabs/supervisor/shared/components/TaskDrawer'
import type {
  CreateTaskRequest,
  DeliverableStatus,
  MissionDocument,
  MissionStatus,
  StatusTone,
  SupervisorDeliverable,
  SupervisorMission,
  SupervisorMissionInternAssignment,
  SupervisorTask,
  TaskStatus,
  UpdateTaskRequest,
} from '@/features/dashboard/types/supervisorDashboard'
import { useI18n } from '@/locales/I18nContext'

import { DeliverableDrawer } from './components/DeliverableDrawer'
import { useMissionData } from './hooks/useMissionData'

interface MissionTabProps {
  missionId: string
}

type MissionDrawerMode = 'deliverable-create' | 'deliverable-edit' | 'task-create' | 'task-edit' | null
type TaskPriority = ReturnType<typeof getTaskPriority>

const missionStatusToneMap: Record<MissionStatus, StatusTone> = {
  template: 'neutral',
  active: 'success',
  paused: 'warning',
  completed: 'neutral',
  cancelled: 'danger',
  archived: 'neutral',
}

const knownDeliverableStatuses: DeliverableStatus[] = [
  'draft',
  'in_progress',
  'awaiting_review',
  'approved',
  'changes_requested',
  'cancelled',
]

const knownTaskStatuses: TaskStatus[] = ['todo', 'in_progress', 'done', 'reopened', 'cancelled']

function formatDate(value: string | null | undefined, fallback: string): string {
  if (!value) {
    return fallback
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return format(parsedDate, 'MMM d, yyyy')
}

function formatStatusLabel(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

function getMissionInterns(mission: SupervisorMission | null): SupervisorMissionInternAssignment[] {
  if (!mission) {
    return []
  }

  if (mission.internAssignments && mission.internAssignments.length > 0) {
    return mission.internAssignments
  }

  if (mission.internIds && mission.internIds.length > 0) {
    return mission.internIds.map((internId, index) => ({
      internId,
      internName: mission.internNames?.[index] || internId,
    }))
  }

  if (mission.internId) {
    return [{ internId: mission.internId, internName: mission.internId }]
  }

  return []
}

function getLinkedTasks(deliverables: SupervisorDeliverable[]): SupervisorTask[] {
  const tasksById = new Map<string, SupervisorTask>()

  for (const deliverable of deliverables) {
    for (const task of deliverable.tasks ?? []) {
      if (!tasksById.has(task.id)) {
        tasksById.set(task.id, {
          ...task,
          deliverableId: task.deliverableId ?? deliverable.id,
          internId: task.internId || deliverable.internId || '',
        })
      }
    }
  }

  return Array.from(tasksById.values()).sort((left, right) => {
    if (!left.dueDate && right.dueDate) {
      return 1
    }
    if (left.dueDate && !right.dueDate) {
      return -1
    }
    return (left.dueDate ?? '').localeCompare(right.dueDate ?? '')
  })
}

function resolveDeliverableTone(status: DeliverableStatus): StatusTone {
  return knownDeliverableStatuses.includes(status) ? getDeliverableStatusTone(status) : 'neutral'
}

function resolveTaskTone(status: TaskStatus): StatusTone {
  return knownTaskStatuses.includes(status) ? getTaskStatusTone(status) : 'neutral'
}

function hasProgress(value: number): boolean {
  return Number.isFinite(value) && value > 0
}

function LoadingState({ t }: { t: (key: string) => string }) {
  return (
    <div className="mission-tab">
      <Panel title={t('dashboard.supervisor.mission.metadata')}>
        <div className="mission-skeleton-stack">
          <Skeleton height="2rem" />
          <Skeleton height="5rem" />
          <Skeleton height="2.5rem" />
          <Skeleton height="7rem" />
        </div>
      </Panel>
      <Panel title={t('dashboard.supervisor.mission.deliverablesTitle')}>
        <Skeleton height="14rem" />
      </Panel>
      <Panel title={t('dashboard.supervisor.mission.tasksTitle')}>
        <Skeleton height="14rem" />
      </Panel>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="dash-empty mission-empty">{text}</div>
}

export function MissionTab({ missionId }: MissionTabProps) {
  const { t } = useI18n()
  const {
    data,
    isLoading,
    error,
    refresh,
    createDeliverable,
    updateDeliverable,
    deleteDeliverable,
    createTask,
    updateTask,
    deleteTask,
    uploadDocumentFile,
    uploadDocumentUrl,
  } = useMissionData(missionId)
  const { toasts, showToast, dismissToast } = useToast()

  const { mission, deliverables, documents, documentsError } = data
  const [resourceUrl, setResourceUrl] = useState('')
  const [resourceFile, setResourceFile] = useState<File | null>(null)
  const [isResourceSubmitting, setIsResourceSubmitting] = useState(false)
  const [drawerMode, setDrawerMode] = useState<MissionDrawerMode>(null)
  const [selectedDeliverable, setSelectedDeliverable] = useState<SupervisorDeliverable | null>(null)
  const [selectedTask, setSelectedTask] = useState<SupervisorTask | null>(null)
  const [confirmingDeliverableId, setConfirmingDeliverableId] = useState<string | null>(null)
  const [confirmingTaskId, setConfirmingTaskId] = useState<string | null>(null)

  const fallbackText = t('dashboard.noData')
  const missionInterns = useMemo(() => getMissionInterns(mission), [mission])
  const internNameById = useMemo(
    () => new Map(missionInterns.map((intern) => [intern.internId, intern.internName])),
    [missionInterns],
  )
  const tasks = useMemo(() => getLinkedTasks(deliverables), [deliverables])

  const handleResourceFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setResourceFile(event.target.files?.[0] ?? null)
  }

  const handleUploadResourceFile = async () => {
    if (!resourceFile) {
      return
    }

    setIsResourceSubmitting(true)
    try {
      await uploadDocumentFile(resourceFile)
      setResourceFile(null)
      showToast(t('dashboard.supervisor.toast.saveSuccess'), 'success')
    } catch {
      showToast(t('dashboard.supervisor.mission.documentsSaveFailed'), 'error')
    } finally {
      setIsResourceSubmitting(false)
    }
  }

  const handleUploadResourceUrl = async () => {
    const nextUrl = resourceUrl.trim()
    if (!nextUrl) {
      return
    }

    setIsResourceSubmitting(true)
    try {
      await uploadDocumentUrl(nextUrl)
      setResourceUrl('')
      showToast(t('dashboard.supervisor.toast.saveSuccess'), 'success')
    } catch {
      showToast(t('dashboard.supervisor.mission.documentsSaveFailed'), 'error')
    } finally {
      setIsResourceSubmitting(false)
    }
  }

  const handleCloseDrawer = () => {
    setDrawerMode(null)
    setSelectedDeliverable(null)
    setSelectedTask(null)
  }

  const handleTaskDrawerSubmit = async (request: CreateTaskRequest | UpdateTaskRequest) => {
    if (drawerMode === 'task-edit' && selectedTask) {
      await updateTask(selectedTask.id, request as UpdateTaskRequest)
    } else {
      await createTask(request as CreateTaskRequest)
    }

    showToast(t('dashboard.supervisor.toast.saveSuccess'), 'success')
  }

  const handleConfirmDeliverableDelete = async (deliverableId: string) => {
    try {
      await deleteDeliverable(deliverableId)
      showToast(t('dashboard.supervisor.toast.deleteSuccess'), 'success')
      setConfirmingDeliverableId(null)
    } catch {
      showToast(t('dashboard.supervisor.error.delete'), 'error')
    }
  }

  const handleConfirmTaskDelete = async (taskId: string) => {
    try {
      await deleteTask(taskId)
      showToast(t('dashboard.supervisor.toast.deleteSuccess'), 'success')
      setConfirmingTaskId(null)
    } catch {
      showToast(t('dashboard.supervisor.error.delete'), 'error')
    }
  }

  const renderDeliverableActions = (deliverable: SupervisorDeliverable) => {
    if (confirmingDeliverableId === deliverable.id) {
      return (
        <span className="mission-inline-confirm">
          <span>{t('dashboard.supervisor.mission.deleteQuestion')}</span>
          <button
            type="button"
            className="mission-icon-button"
            aria-label={t('dashboard.supervisor.mission.confirmDelete')}
            onClick={() => {
              void handleConfirmDeliverableDelete(deliverable.id)
            }}
          >
            &#10003;
          </button>
          <button
            type="button"
            className="mission-icon-button"
            aria-label={t('dashboard.supervisor.mission.cancelDelete')}
            onClick={() => setConfirmingDeliverableId(null)}
          >
            &#10005;
          </button>
        </span>
      )
    }

    return (
      <span className="mission-row-actions">
        <DashboardButton
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t('dashboard.supervisor.mission.editDeliverable')}
          onClick={() => {
            setSelectedDeliverable(deliverable)
            setDrawerMode('deliverable-edit')
          }}
        >
          <Edit />
        </DashboardButton>
        <DashboardButton
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t('dashboard.table.delete')}
          onClick={() => setConfirmingDeliverableId(deliverable.id)}
        >
          <Trash2 />
        </DashboardButton>
      </span>
    )
  }

  const renderTaskActions = (task: SupervisorTask) => {
    if (confirmingTaskId === task.id) {
      return (
        <span className="mission-inline-confirm">
          <span>{t('dashboard.supervisor.mission.deleteQuestion')}</span>
          <button
            type="button"
            className="mission-icon-button"
            aria-label={t('dashboard.supervisor.mission.confirmDelete')}
            onClick={() => {
              void handleConfirmTaskDelete(task.id)
            }}
          >
            &#10003;
          </button>
          <button
            type="button"
            className="mission-icon-button"
            aria-label={t('dashboard.supervisor.mission.cancelDelete')}
            onClick={() => setConfirmingTaskId(null)}
          >
            &#10005;
          </button>
        </span>
      )
    }

    return (
      <span className="mission-row-actions">
        <DashboardButton
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t('dashboard.supervisor.mission.editTask')}
          onClick={() => {
            setSelectedTask(task)
            setDrawerMode('task-edit')
          }}
        >
          <Edit />
        </DashboardButton>
        <DashboardButton
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t('dashboard.table.delete')}
          onClick={() => setConfirmingTaskId(task.id)}
        >
          <Trash2 />
        </DashboardButton>
      </span>
    )
  }

  const renderResourceRow = (document: MissionDocument) => {
    const isFile = document.sourceType === 'file'
    const sourceLabel = isFile
      ? t('dashboard.supervisor.mission.source.file')
      : t('dashboard.supervisor.mission.source.url')
    const sourceClass = isFile ? 'mission-resource-source-file' : 'mission-resource-source-url'
    const linkLabel = isFile
      ? t('dashboard.supervisor.mission.downloadResource')
      : t('dashboard.supervisor.mission.openResource')

    return (
      <li key={document.id} className="mission-resource-row">
        <div className="mission-resource-row-main">
          <span className="mission-resource-name" title={document.fileName}>
            {document.fileName || fallbackText}
          </span>
          <span className="mission-resource-meta">
            <span className={`mission-resource-source ${sourceClass}`}>{sourceLabel}</span>
            <span>{formatDate(document.uploadedAt, fallbackText)}</span>
          </span>
        </div>
        <div className="mission-resource-actions">
          {document.fileUrl ? (
            <a
              className="mission-resource-link"
              href={document.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={isFile ? document.fileName : undefined}
            >
              {isFile ? <Download /> : <Eye />}
              {linkLabel}
            </a>
          ) : null}
        </div>
      </li>
    )
  }

  if (isLoading) {
    return (
      <>
        <LoadingState t={t} />
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </>
    )
  }

  if (error) {
    return (
      <>
        <ErrorState message={error} onRetry={() => { void refresh() }} />
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </>
    )
  }

  if (!mission) {
    return (
      <>
        <Panel title={t('dashboard.supervisor.mission.metadata')}>
          <EmptyState text={t('dashboard.supervisor.overview.noMission')} />
        </Panel>
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </>
    )
  }

  const hasInterns = missionInterns.length > 0
  const showProgress = hasProgress(mission.rawProgress)
  const showCreatedAt = Boolean(mission.createdAt)
  const isUploadBusy = isResourceSubmitting

  return (
    <>
      <div className="mission-tab">
        <Panel title={t('dashboard.supervisor.mission.metadata')}>
          <div className="mission-readonly">
              <section className="mission-section" aria-labelledby="mission-overview-heading">
                <h4 id="mission-overview-heading" className="mission-section-title">
                  {t('dashboard.supervisor.mission.overviewSection')}
                </h4>
                <div className="mission-section-body">
                  <div className="mission-readonly-hero">
                    <h3>{mission.title || fallbackText}</h3>
                    <p>{mission.description || fallbackText}</p>
                  </div>
                </div>
              </section>

              <section className="mission-section" aria-labelledby="mission-status-heading">
                <h4 id="mission-status-heading" className="mission-section-title">
                  {t('dashboard.supervisor.mission.statusSection')}
                </h4>
                <div className="mission-section-body">
                  <div className="mission-status-row">
                    <StatusBadge
                      label={t(`dashboard.supervisor.status.${mission.status}`)}
                      tone={missionStatusToneMap[mission.status]}
                      size="md"
                    />
                  </div>
                </div>
              </section>

              <section className="mission-section" aria-labelledby="mission-timeline-heading">
                <h4 id="mission-timeline-heading" className="mission-section-title">
                  {t('dashboard.supervisor.mission.timelineSection')}
                </h4>
                <div className="mission-section-body">
                  <dl className="mission-meta-list">
                    <div className="mission-meta-list__row">
                      <dt>{t('dashboard.supervisor.overview.startDate')}</dt>
                      <dd>{formatDate(mission.startDate, fallbackText)}</dd>
                    </div>
                    <div className="mission-meta-list__row">
                      <dt>{t('dashboard.supervisor.overview.endDate')}</dt>
                      <dd>{formatDate(mission.endDate, fallbackText)}</dd>
                    </div>
                    {showCreatedAt ? (
                      <div className="mission-meta-list__row">
                        <dt>{t('dashboard.supervisor.mission.createdAtLabel')}</dt>
                        <dd>{formatDate(mission.createdAt, fallbackText)}</dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              </section>

              <section className="mission-section" aria-labelledby="mission-people-heading">
                <h4 id="mission-people-heading" className="mission-section-title">
                  {t('dashboard.supervisor.mission.peopleSection')}
                </h4>
                <div className="mission-section-body">
                  <dl className="mission-meta-list">
                    <div className="mission-meta-list__row">
                      <dt>{t('dashboard.supervisor.mission.supervisorLabel')}</dt>
                      <dd>{mission.supervisorId || fallbackText}</dd>
                    </div>
                    <div className="mission-meta-list__row">
                      <dt>{t('dashboard.supervisor.mission.coSupervisorLabel')}</dt>
                      <dd>
                        {mission.coSupervisorId
                          ? mission.coSupervisorId
                          : t('dashboard.supervisor.mission.coSupervisorMissing')}
                      </dd>
                    </div>
                    <div className="mission-meta-list__row">
                      <dt>{t('dashboard.supervisor.mission.internsLabel')}</dt>
                      <dd>
                        {hasInterns ? (
                          <span className="mission-intern-list">
                            {missionInterns.map((intern) => (
                              <span key={intern.internId} className="mission-intern-chip">
                                {intern.internName || intern.internId}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="mission-muted">
                            {t('dashboard.supervisor.mission.noInterns')}
                          </span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              </section>

              {showProgress ? (
                <section className="mission-section" aria-labelledby="mission-progress-heading">
                  <h4 id="mission-progress-heading" className="mission-section-title">
                    {t('dashboard.supervisor.mission.progressLabel')}
                  </h4>
                  <div className="mission-section-body">
                    <div className="mission-progress-row">
                      <div
                        className="mission-progress-bar"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={clampProgress(mission.rawProgress)}
                        aria-label={t('dashboard.supervisor.mission.progressLabel')}
                      >
                        <span
                          className="mission-progress-fill"
                          style={{ transform: `scaleX(${clampProgress(mission.rawProgress) / 100})` }}
                        />
                      </div>
                      <span className="mission-progress-value">{clampProgress(mission.rawProgress)}%</span>
                    </div>
                  </div>
                </section>
              ) : null}

              <section className="mission-resource-section" aria-labelledby="mission-resource-heading">
                <div className="mission-resource-section-header">
                  <h4 id="mission-resource-heading">
                    {t('dashboard.supervisor.mission.resourcesSection')}
                  </h4>
                </div>

                <div className="mission-resource-upload">
                  <div className="mission-resource-upload-row">
                    <label className="mission-resource-file-name" htmlFor="mission-resource-file">
                      {resourceFile
                        ? resourceFile.name
                        : t('dashboard.supervisor.mission.chooseFile')}
                    </label>
                    <input
                      id="mission-resource-file"
                      type="file"
                      className="dash-input"
                      onChange={handleResourceFileChange}
                      disabled={isUploadBusy}
                    />
                    <DashboardButton
                      type="button"
                      variant="primary"
                      size="sm"
                      loading={isUploadBusy}
                      disabled={!resourceFile || isUploadBusy}
                      onClick={() => {
                        void handleUploadResourceFile()
                      }}
                    >
                      {isUploadBusy
                        ? t('dashboard.supervisor.mission.uploading')
                        : t('dashboard.supervisor.mission.uploadFileButton')}
                    </DashboardButton>
                  </div>

                  <div className="mission-resource-divider" aria-hidden="true">
                    <span>or</span>
                  </div>

                  <div className="mission-resource-upload-row">
                    <input
                      type="url"
                      className="dash-input"
                      value={resourceUrl}
                      placeholder={t('dashboard.supervisor.mission.urlPlaceholder')}
                      onChange={(event) => setResourceUrl(event.target.value)}
                      disabled={isUploadBusy}
                    />
                    <DashboardButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={isUploadBusy}
                      disabled={!resourceUrl.trim() || isUploadBusy}
                      onClick={() => {
                        void handleUploadResourceUrl()
                      }}
                    >
                      {t('dashboard.supervisor.mission.uploadUrlButton')}
                    </DashboardButton>
                  </div>
                </div>

                {documentsError ? (
                  <p className="mission-resource-error" role="alert">
                    {documentsError}
                  </p>
                ) : null}

                {documents.length === 0 ? (
                  <EmptyState text={t('dashboard.supervisor.mission.noResources')} />
                ) : (
                  <ul className="mission-resource-list">{documents.map(renderResourceRow)}</ul>
                )}
              </section>
            </div>
          </Panel>

        <Panel
          title={t('dashboard.supervisor.mission.deliverablesTitle')}
          actions={(
            <DashboardButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setDrawerMode('deliverable-create')}
            >
              <Plus />
              {t('dashboard.supervisor.mission.addDeliverable')}
            </DashboardButton>
          )}
        >
            {deliverables.length === 0 ? (
              <EmptyState text={t('dashboard.supervisor.empty.noDeliverables')} />
            ) : (
              <div className="dash-table-wrapper">
                <table className="dash-table mission-table">
                  <thead>
                    <tr>
                      <th>{t('dashboard.table.name')}</th>
                      <th>{t('dashboard.table.dueDate')}</th>
                      <th>{t('dashboard.supervisor.mission.weight')}</th>
                      <th>{t('dashboard.table.status')}</th>
                      <th>{t('dashboard.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliverables.map((deliverable) => (
                      <tr key={deliverable.id}>
                        <td data-label={t('dashboard.table.name')}>{deliverable.title}</td>
                        <td data-label={t('dashboard.table.dueDate')}>{formatDate(deliverable.dueDate, fallbackText)}</td>
                        <td data-label={t('dashboard.supervisor.mission.weight')}>{deliverable.weight}%</td>
                        <td data-label={t('dashboard.table.status')}>
                          <StatusBadge
                            label={
                              knownDeliverableStatuses.includes(deliverable.status)
                                ? t(`dashboard.supervisor.deliverables.status.${deliverable.status}`)
                                : formatStatusLabel(deliverable.status)
                            }
                            tone={resolveDeliverableTone(deliverable.status)}
                            size="sm"
                          />
                        </td>
                        <td data-label={t('dashboard.table.actions')}>{renderDeliverableActions(deliverable)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

        <Panel
          title={t('dashboard.supervisor.mission.tasksTitle')}
          actions={(
            <DashboardButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setDrawerMode('task-create')}
            >
              <Plus />
              {t('dashboard.supervisor.mission.addTask')}
            </DashboardButton>
          )}
        >
            {tasks.length === 0 ? (
              <EmptyState text={t('dashboard.supervisor.mission.noTasks')} />
            ) : (
              <div className="dash-table-wrapper">
                <table className="dash-table mission-table">
                  <thead>
                    <tr>
                      <th>{t('dashboard.table.name')}</th>
                      <th>{t('dashboard.supervisor.mission.priority')}</th>
                      <th>{t('dashboard.table.dueDate')}</th>
                      <th>{t('dashboard.supervisor.mission.assignedIntern')}</th>
                      <th>{t('dashboard.table.status')}</th>
                      <th>{t('dashboard.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map((task) => {
                      const priority: TaskPriority = getTaskPriority(task.dueDate ?? undefined)
                      return (
                        <tr key={task.id}>
                          <td data-label={t('dashboard.table.name')}>{task.title}</td>
                          <td data-label={t('dashboard.supervisor.mission.priority')}>
                            {t(`dashboard.supervisor.mission.priority.${priority}`)}
                          </td>
                          <td data-label={t('dashboard.table.dueDate')}>{formatDate(task.dueDate, fallbackText)}</td>
                          <td data-label={t('dashboard.supervisor.mission.assignedIntern')}>
                            {internNameById.get(task.internId) ?? task.internId}
                          </td>
                          <td data-label={t('dashboard.table.status')}>
                            <StatusBadge
                              label={
                                knownTaskStatuses.includes(task.status)
                                  ? t(`dashboard.supervisor.tasks.status.${task.status}`)
                                  : formatStatusLabel(task.status)
                              }
                              tone={resolveTaskTone(task.status)}
                              size="sm"
                            />
                          </td>
                          <td data-label={t('dashboard.table.actions')}>{renderTaskActions(task)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
      </div>

      <DeliverableDrawer
        isOpen={drawerMode === 'deliverable-create' || drawerMode === 'deliverable-edit'}
        mode={drawerMode === 'deliverable-edit' ? 'edit' : 'create'}
        missionId={missionId}
        defaultInternId={missionInterns[0]?.internId}
        deliverable={selectedDeliverable}
        onClose={handleCloseDrawer}
        createDeliverable={createDeliverable}
        updateDeliverable={updateDeliverable}
        showToast={showToast}
      />

      <TaskDrawer
        isOpen={drawerMode === 'task-create' || drawerMode === 'task-edit'}
        mode={drawerMode === 'task-edit' ? 'edit' : 'create'}
        task={selectedTask}
        missionInterns={missionInterns}
        deliverables={deliverables}
        onClose={handleCloseDrawer}
        onSubmit={handleTaskDrawerSubmit}
        showToast={showToast}
      />

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}

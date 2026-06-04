import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { format } from 'date-fns'

import { DashboardButton } from '@/features/dashboard/components/DashboardButton'
import { ErrorState } from '@/features/dashboard/components/ErrorState'
import { Edit, Plus, Trash2 } from '@/features/dashboard/components/IconComponents'
import { Panel } from '@/features/dashboard/components/Panel'
import { Skeleton } from '@/features/dashboard/components/Skeleton'
import { StatusBadge } from '@/features/dashboard/components/StatusBadge'
import { Toast } from '@/features/dashboard/components/Toast/Toast'
import { useToast } from '@/features/dashboard/components/Toast/useToast'
import { getDeliverableStatusTone, getTaskPriority, getTaskStatusTone } from '@/features/dashboard/shared/utils/supervisorUtils'
import { TaskDrawer } from '@/features/dashboard/tabs/supervisor/shared/components/TaskDrawer'
import type {
  CreateTaskRequest,
  DeliverableStatus,
  MissionStatus,
  StatusTone,
  SupervisorDeliverable,
  SupervisorMission,
  SupervisorMissionInternAssignment,
  SupervisorTask,
  TaskStatus,
  UpdateMissionRequest,
  UpdateTaskRequest,
} from '@/features/dashboard/types/supervisorDashboard'
import { useAuth } from '@/stores/AuthContext'
import { useI18n } from '@/locales/I18nContext'

import { DeliverableDrawer } from './components/DeliverableDrawer'
import { FeatureFlagPanel } from './components/FeatureFlagPanel'
import { useMissionData } from './hooks/useMissionData'

interface MissionTabProps {
  missionId: string
}

type MissionDrawerMode = 'deliverable-create' | 'deliverable-edit' | 'task-create' | 'task-edit' | null
type TaskPriority = ReturnType<typeof getTaskPriority>

const missionStatusToneMap: Record<MissionStatus, StatusTone> = {
  draft: 'neutral',
  active: 'success',
  paused: 'warning',
  completed: 'neutral',
  cancelled: 'danger',
  archived: 'neutral',
}

const missionStatusTransitions: Record<MissionStatus, MissionStatus[]> = {
  draft: ['active'],
  active: ['paused', 'completed'],
  paused: ['active', 'cancelled'],
  completed: ['archived'],
  cancelled: [],
  archived: [],
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
const defaultLevelOptions = ['junior', 'intermediate', 'senior']

function toDateInputValue(value: string | null | undefined): string {
  if (!value) {
    return ''
  }

  const isoDateMatch = /^\d{4}-\d{2}-\d{2}/.exec(value)
  if (isoDateMatch) {
    return isoDateMatch[0]
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  return parsedDate.toISOString().slice(0, 10)
}

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

function missionToFormValues(mission: SupervisorMission): Partial<SupervisorMission> {
  return {
    title: mission.title ?? '',
    description: mission.description ?? '',
    skills: [...(mission.skills ?? [])],
    tools: mission.tools ?? '',
    level: mission.level ?? '',
    status: mission.status,
    startDate: toDateInputValue(mission.startDate),
    endDate: toDateInputValue(mission.endDate),
  }
}

function buildMissionPatch(formValues: Partial<SupervisorMission>): Partial<UpdateMissionRequest> {
  return {
    Title: formValues.title?.trim() ?? '',
    Description: formValues.description ?? '',
    Skills: formValues.skills ?? [],
    Level: formValues.level ?? '',
    StartDate: formValues.startDate || null,
    EndDate: formValues.endDate || null,
  }
}

function isValidDatePair(startDate: string | null | undefined, endDate: string | null | undefined): boolean {
  if (!startDate || !endDate) {
    return true
  }

  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return true
  }

  return end.getTime() > start.getTime()
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

function LoadingState() {
  return (
    <div className="mission-tab mission-tab-grid">
      <Panel title="Mission">
        <div className="mission-skeleton-stack">
          <Skeleton height="2rem" />
          <Skeleton height="5rem" />
          <Skeleton height="2.5rem" />
          <Skeleton height="7rem" />
        </div>
      </Panel>
      <div className="mission-right-column">
        <Panel title="Deliverables">
          <Skeleton height="14rem" />
        </Panel>
        <Panel title="Tasks">
          <Skeleton height="14rem" />
        </Panel>
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="dash-empty mission-empty">{text}</div>
}

export function MissionTab({ missionId }: MissionTabProps) {
  const { t } = useI18n()
  const { user } = useAuth()
  const {
    data,
    isLoading,
    error,
    refresh,
    updateMission,
    patchMissionStatus,
    updateFeatureFlags,
    createDeliverable,
    updateDeliverable,
    deleteDeliverable,
    createTask,
    updateTask,
    deleteTask,
  } = useMissionData(missionId)
  const { toasts, showToast, dismissToast } = useToast()

  const { mission, featureFlags, deliverables } = data
  const [editMode, setEditMode] = useState(false)
  const [formValues, setFormValues] = useState<Partial<SupervisorMission>>({})
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [skillDraft, setSkillDraft] = useState('')
  const [resourceUrl, setResourceUrl] = useState('')
  const [drawerMode, setDrawerMode] = useState<MissionDrawerMode>(null)
  const [selectedDeliverable, setSelectedDeliverable] = useState<SupervisorDeliverable | null>(null)
  const [selectedTask, setSelectedTask] = useState<SupervisorTask | null>(null)
  const [confirmingDeliverableId, setConfirmingDeliverableId] = useState<string | null>(null)
  const [confirmingTaskId, setConfirmingTaskId] = useState<string | null>(null)
  const [statusUpdatingTo, setStatusUpdatingTo] = useState<MissionStatus | null>(null)

  useEffect(() => {
    if (!mission || editMode) {
      return
    }

    setFormValues(missionToFormValues(mission))
    setSkillDraft('')
  }, [editMode, mission])

  const missionInterns = useMemo(() => getMissionInterns(mission), [mission])
  const internNameById = useMemo(
    () => new Map(missionInterns.map((intern) => [intern.internId, intern.internName])),
    [missionInterns],
  )
  const tasks = useMemo(() => getLinkedTasks(deliverables), [deliverables])
  const fallbackText = t('dashboard.noData')
  const currentMissionStatus = formValues.status ?? mission?.status ?? 'draft'
  const validTransitions = missionStatusTransitions[currentMissionStatus]
  const canManageFeatureFlags = Boolean(user?.id && mission?.supervisorId && mission.supervisorId === user.id)
  const levelOptions = useMemo(() => {
    const currentLevel = (formValues.level ?? mission?.level ?? '').trim()
    return Array.from(new Set([currentLevel, ...defaultLevelOptions].filter(Boolean)))
  }, [formValues.level, mission?.level])

  const clearFormError = (field: string) => {
    setFormErrors((previous) => {
      if (!previous[field]) {
        return previous
      }
      const nextErrors = { ...previous }
      delete nextErrors[field]
      return nextErrors
    })
  }

  const handleMissionFieldChange = (field: keyof SupervisorMission, value: string) => {
    setFormValues((previous) => ({ ...previous, [field]: value }))

    if (field === 'title') {
      clearFormError('title')
    }

    if (field === 'startDate' || field === 'endDate') {
      clearFormError('endDate')
    }
  }

  const handleAddSkill = (rawSkill: string) => {
    const nextSkill = rawSkill.trim()
    if (!nextSkill) {
      return
    }

    setFormValues((previous) => {
      const currentSkills = previous.skills ?? []
      const alreadyExists = currentSkills.some((skill) => skill.toLocaleLowerCase() === nextSkill.toLocaleLowerCase())
      return alreadyExists ? previous : { ...previous, skills: [...currentSkills, nextSkill] }
    })
    setSkillDraft('')
  }

  const handleSkillKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' && event.key !== ',') {
      return
    }

    event.preventDefault()
    handleAddSkill(skillDraft)
  }

  const handleRemoveSkill = (skillToRemove: string) => {
    setFormValues((previous) => ({
      ...previous,
      skills: (previous.skills ?? []).filter((skill) => skill !== skillToRemove),
    }))
  }

  const validateMissionForm = () => {
    const nextErrors: Record<string, string> = {}

    if (!(formValues.title ?? '').trim()) {
      nextErrors.title = t('dashboard.supervisor.mission.titleRequired')
    }

    if (!isValidDatePair(formValues.startDate, formValues.endDate)) {
      nextErrors.endDate = t('dashboard.supervisor.mission.dateRangeInvalid')
    }

    setFormErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleMissionSave = async () => {
    if (!validateMissionForm()) {
      return
    }

    try {
      await updateMission(buildMissionPatch(formValues))
      showToast(t('dashboard.supervisor.toast.saveSuccess'), 'success')
      setEditMode(false)
    } catch {
      showToast(t('dashboard.supervisor.error.save'), 'error')
    }
  }

  const handleMissionCancel = () => {
    if (mission) {
      setFormValues(missionToFormValues(mission))
    }
    setSkillDraft('')
    setFormErrors({})
    setEditMode(false)
  }

  const handlePatchStatus = async (nextStatus: MissionStatus) => {
    setStatusUpdatingTo(nextStatus)
    try {
      await patchMissionStatus(nextStatus)
      setFormValues((previous) => ({ ...previous, status: nextStatus }))
      showToast(t('dashboard.supervisor.toast.saveSuccess'), 'success')
    } catch {
      showToast(t('dashboard.supervisor.error.status'), 'error')
    } finally {
      setStatusUpdatingTo(null)
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

  if (isLoading) {
    return (
      <>
        <LoadingState />
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

  return (
    <>
      <div className="mission-tab mission-tab-grid">
        <div className="mission-left-column">
          <Panel
            title={t('dashboard.supervisor.mission.metadata')}
            actions={
              !editMode ? (
                <DashboardButton type="button" variant="secondary" size="sm" onClick={() => setEditMode(true)}>
                  {t('dashboard.supervisor.mission.edit')}
                </DashboardButton>
              ) : null
            }
          >
            {!editMode ? (
              <div className="mission-readonly">
                <div className="mission-readonly-hero">
                  <h3>{mission.title || fallbackText}</h3>
                  <p>{mission.description || fallbackText}</p>
                </div>

                <div className="mission-skill-list">
                  {(mission.skills ?? []).length > 0 ? (
                    mission.skills.map((skill) => <StatusBadge key={skill} label={skill} tone="info" size="sm" />)
                  ) : (
                    <span className="mission-muted">{fallbackText}</span>
                  )}
                </div>

                <dl className="mission-meta-list">
                  <div>
                    <dt>{t('dashboard.supervisor.mission.tools')}</dt>
                    <dd>{mission.tools || fallbackText}</dd>
                  </div>
                  <div>
                    <dt>{t('dashboard.form.level')}</dt>
                    <dd>{mission.level || fallbackText}</dd>
                  </div>
                  <div>
                    <dt>{t('dashboard.form.status')}</dt>
                    <dd>
                      <StatusBadge
                        label={t(`dashboard.supervisor.status.${mission.status}`)}
                        tone={missionStatusToneMap[mission.status]}
                        size="sm"
                      />
                    </dd>
                  </div>
                  <div>
                    <dt>{t('dashboard.supervisor.overview.startDate')}</dt>
                    <dd>{formatDate(mission.startDate, fallbackText)}</dd>
                  </div>
                  <div>
                    <dt>{t('dashboard.supervisor.overview.endDate')}</dt>
                    <dd>{formatDate(mission.endDate, fallbackText)}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <form
                className="mission-edit-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void handleMissionSave()
                }}
              >
                <label className="mission-form-field" htmlFor="mission-title">
                  <span>{t('dashboard.form.title')}</span>
                  <input
                    id="mission-title"
                    type="text"
                    className="dash-input"
                    value={formValues.title ?? ''}
                    onChange={(event) => handleMissionFieldChange('title', event.target.value)}
                  />
                  {formErrors.title && <p className="form-error">{formErrors.title}</p>}
                </label>

                <label className="mission-form-field" htmlFor="mission-description">
                  <span>{t('dashboard.form.description')}</span>
                  <textarea
                    id="mission-description"
                    className="dash-textarea"
                    rows={5}
                    value={formValues.description ?? ''}
                    onChange={(event) => handleMissionFieldChange('description', event.target.value)}
                  />
                </label>

                <div className="mission-form-field">
                  <span>{t('dashboard.intern.profile.skills')}</span>
                  <div className="mission-skill-editor">
                    <div className="mission-skill-list">
                      {(formValues.skills ?? []).map((skill) => (
                        <span key={skill} className="mission-skill-chip">
                          <StatusBadge label={skill} tone="info" size="sm" />
                          <button
                            type="button"
                            aria-label={t('dashboard.supervisor.mission.removeSkill', { skill })}
                            onClick={() => handleRemoveSkill(skill)}
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                    <input
                      type="text"
                      className="dash-input"
                      value={skillDraft}
                      placeholder={t('dashboard.supervisor.mission.addSkillPlaceholder')}
                      onChange={(event) => setSkillDraft(event.target.value)}
                      onKeyDown={handleSkillKeyDown}
                      onBlur={() => handleAddSkill(skillDraft)}
                    />
                  </div>
                </div>

                <label className="mission-form-field" htmlFor="mission-level">
                  <span>{t('dashboard.form.level')}</span>
                  <select
                    id="mission-level"
                    className="dash-input dash-select"
                    value={formValues.level ?? ''}
                    onChange={(event) => handleMissionFieldChange('level', event.target.value)}
                  >
                    {levelOptions.map((level) => (
                      <option key={level} value={level}>
                        {t(`dashboard.supervisor.mission.level.${level}`) === `dashboard.supervisor.mission.level.${level}`
                          ? formatStatusLabel(level)
                          : t(`dashboard.supervisor.mission.level.${level}`)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="mission-form-field">
                  <span>{t('dashboard.supervisor.mission.statusTransitions')}</span>
                  <div className="mission-status-row">
                    <StatusBadge
                      label={t(`dashboard.supervisor.status.${currentMissionStatus}`)}
                      tone={missionStatusToneMap[currentMissionStatus]}
                      size="sm"
                    />
                    {validTransitions.length > 0 ? (
                      validTransitions.map((nextStatus) => (
                        <DashboardButton
                          key={nextStatus}
                          type="button"
                          variant="secondary"
                          size="sm"
                          loading={statusUpdatingTo === nextStatus}
                          disabled={Boolean(statusUpdatingTo)}
                          onClick={() => {
                            void handlePatchStatus(nextStatus)
                          }}
                        >
                          {t(`dashboard.supervisor.status.${nextStatus}`)}
                        </DashboardButton>
                      ))
                    ) : (
                      <span className="mission-muted">{t('dashboard.supervisor.mission.noTransitions')}</span>
                    )}
                  </div>
                </div>

                <div className="mission-date-pair">
                  <label className="mission-form-field" htmlFor="mission-start-date">
                    <span>{t('dashboard.supervisor.overview.startDate')}</span>
                    <input
                      id="mission-start-date"
                      type="date"
                      className="dash-input"
                      value={formValues.startDate ?? ''}
                      onChange={(event) => handleMissionFieldChange('startDate', event.target.value)}
                    />
                  </label>
                  <label className="mission-form-field" htmlFor="mission-end-date">
                    <span>{t('dashboard.supervisor.overview.endDate')}</span>
                    <input
                      id="mission-end-date"
                      type="date"
                      className="dash-input"
                      value={formValues.endDate ?? ''}
                      onChange={(event) => handleMissionFieldChange('endDate', event.target.value)}
                    />
                    {formErrors.endDate && <p className="form-error">{formErrors.endDate}</p>}
                  </label>
                </div>

                <div className="mission-form-actions">
                  <DashboardButton type="button" variant="secondary" size="sm" onClick={handleMissionCancel}>
                    {t('dashboard.form.cancel')}
                  </DashboardButton>
                  <DashboardButton type="submit" variant="primary" size="sm">
                    {t('dashboard.form.save')}
                  </DashboardButton>
                </div>
              </form>
            )}

            <section className="mission-resource-panel" aria-labelledby="mission-resource-title">
              <div className="mission-section-heading">
                <h4 id="mission-resource-title">{t('dashboard.supervisor.mission.resources')}</h4>
              </div>
              <div className="mission-resource-dropzone" aria-disabled="true">
                <StatusBadge label={t('dashboard.supervisor.mission.uploadComingSoon')} tone="neutral" size="sm" />
              </div>
              <input
                type="url"
                className="dash-input"
                value={resourceUrl}
                placeholder={t('dashboard.supervisor.mission.resourceUrlPlaceholder')}
                onChange={(event) => setResourceUrl(event.target.value)}
              />
            </section>

            {canManageFeatureFlags && (
              <FeatureFlagPanel
                featureFlags={featureFlags}
                updateFeatureFlags={updateFeatureFlags}
                showToast={showToast}
              />
            )}
          </Panel>
        </div>

        <div className="mission-right-column">
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

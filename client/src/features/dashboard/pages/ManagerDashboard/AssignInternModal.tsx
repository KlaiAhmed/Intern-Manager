import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { DashboardButton } from '../../components/DashboardButton'
import { Modal } from '../../components/Modal'
import { Skeleton } from '../../components/Skeleton'
import { useDashboardApi } from '../../hooks/useDashboardApi'
import { toDashboardErrorMessage } from '../../shared/utils/errorMessage'
import { toIsoDate } from '../../shared/utils/operations'
import { asNonEmptyString } from './utils'
import type { Department, Intern, PagedResponse } from './types'

interface AssignInternModalProps {
  isOpen: boolean
  intern: Intern | null
  onClose: () => void
  departments: Department[]
  loadingDepartments: boolean
  departmentsError: string | null
  onAssignmentSuccess: () => Promise<void> | void
}

interface MissionPayload {
  id?: string
  title?: string
  status?: string
  internName?: string | null
  supervisorName?: string | null
}

interface ReferentialPayload {
  id?: string
  name?: string
}

interface ReferentialOption {
  id: string
  name: string
}

interface MissionOption {
  id: string
  title: string
  status: string
  internName: string | null
  supervisorName: string | null
}

interface AssignmentFormState {
  missionId: string
  departmentId: string
  internshipTypeId: string
  startDate: string
  endDate: string
  skillIds: string[]
}

interface AssignmentFieldErrors {
  missionId?: string
  startDate?: string
  endDate?: string
}

interface AssignStageResponse {
  missionId?: string
  internId?: string
  status?: string
  verificationStatus?: string
  startDate?: string
  endDate?: string
}

const defaultAssignmentForm: AssignmentFormState = {
  missionId: '',
  departmentId: '',
  internshipTypeId: '',
  startDate: '',
  endDate: '',
  skillIds: [],
}

function parseReferentialOptions(payload: PagedResponse<ReferentialPayload> | ReferentialPayload[]): ReferentialOption[] {
  const entries = Array.isArray(payload) ? payload : payload.data ?? []

  return entries
    .map((entry): ReferentialOption | null => {
      const id = asNonEmptyString(entry.id)
      const name = asNonEmptyString(entry.name)
      if (!id || !name) return null
      return { id, name }
    })
    .filter((entry): entry is ReferentialOption => entry !== null)
}

export function AssignInternModal({
  isOpen,
  intern,
  onClose,
  departments,
  loadingDepartments,
  departmentsError,
  onAssignmentSuccess,
}: AssignInternModalProps) {
  const { t } = useI18n()
  const api = useDashboardApi()

  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>(defaultAssignmentForm)
  const [assignmentFieldErrors, setAssignmentFieldErrors] = useState<AssignmentFieldErrors>({})
  const [assignmentSubmitting, setAssignmentSubmitting] = useState(false)
  const [assignmentError, setAssignmentError] = useState<string | null>(null)
  const [assignmentSuccess, setAssignmentSuccess] = useState<string | null>(null)

  const [assignmentOptionsLoading, setAssignmentOptionsLoading] = useState(false)
  const [assignmentOptionsError, setAssignmentOptionsError] = useState<string | null>(null)
  const [missionOptions, setMissionOptions] = useState<MissionOption[]>([])
  const [typeOptions, setTypeOptions] = useState<ReferentialOption[]>([])
  const [skillOptions, setSkillOptions] = useState<ReferentialOption[]>([])

  const targetInternId = asNonEmptyString(intern?.id)

  const loadAssignmentOptions = useCallback(async () => {
    setAssignmentOptionsLoading(true)
    setAssignmentOptionsError(null)

    const [missionsResult, typesResult, skillsResult] = await Promise.allSettled([
      api.get<PagedResponse<MissionPayload>>('/api/missions?page=1&limit=200'),
      api.get<PagedResponse<ReferentialPayload> | ReferentialPayload[]>('/api/admin/settings/internship-types'),
      api.get<PagedResponse<ReferentialPayload> | ReferentialPayload[]>('/api/admin/settings/skills'),
    ])

    const errors: string[] = []

    if (missionsResult.status === 'fulfilled') {
      const parsedMissions = (missionsResult.value.data ?? [])
        .map((mission): MissionOption | null => {
          const id = asNonEmptyString(mission.id)
          const title = asNonEmptyString(mission.title)
          if (!id || !title) return null

          return {
            id,
            title,
            status: asNonEmptyString(mission.status),
            internName: asNonEmptyString(mission.internName) || null,
            supervisorName: asNonEmptyString(mission.supervisorName) || null,
          }
        })
        .filter((mission): mission is MissionOption => mission !== null)

      setMissionOptions(parsedMissions)
    } else {
      errors.push(toDashboardErrorMessage(missionsResult.reason))
      setMissionOptions([])
    }

    if (typesResult.status === 'fulfilled') {
      setTypeOptions(parseReferentialOptions(typesResult.value))
    } else {
      errors.push(toDashboardErrorMessage(typesResult.reason))
      setTypeOptions([])
    }

    if (skillsResult.status === 'fulfilled') {
      setSkillOptions(parseReferentialOptions(skillsResult.value))
    } else {
      errors.push(toDashboardErrorMessage(skillsResult.reason))
      setSkillOptions([])
    }

    setAssignmentOptionsError(errors.length > 0
      ? 'Some assignment options failed to load. You can still submit with available fields.'
      : null)

    setAssignmentOptionsLoading(false)
  }, [api])

  useEffect(() => {
    if (!isOpen || !targetInternId) {
      return
    }

    setAssignmentForm(defaultAssignmentForm)
    setAssignmentFieldErrors({})
    setAssignmentError(null)
    setAssignmentSuccess(null)

    void loadAssignmentOptions()
  }, [isOpen, loadAssignmentOptions, targetInternId])

  const toggleSkill = (skillId: string) => {
    setAssignmentForm((previous) => {
      if (previous.skillIds.includes(skillId)) {
        return {
          ...previous,
          skillIds: previous.skillIds.filter((id) => id !== skillId),
        }
      }

      return {
        ...previous,
        skillIds: [...previous.skillIds, skillId],
      }
    })
  }

  const submitAssignment = async () => {
    if (!targetInternId) {
      setAssignmentError('Unable to resolve intern id.')
      return
    }

    const fieldErrors: AssignmentFieldErrors = {}
    if (!assignmentForm.missionId.trim()) {
      fieldErrors.missionId = 'Mission is required.'
    }

    if (!assignmentForm.startDate) {
      fieldErrors.startDate = 'Start date is required.'
    }

    if (!assignmentForm.endDate) {
      fieldErrors.endDate = 'End date is required.'
    }

    if (assignmentForm.startDate && assignmentForm.endDate) {
      const startDate = new Date(assignmentForm.startDate)
      const endDate = new Date(assignmentForm.endDate)
      if (endDate <= startDate) {
        fieldErrors.endDate = 'End date must be later than start date.'
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      setAssignmentFieldErrors(fieldErrors)
      setAssignmentError(null)
      return
    }

    setAssignmentFieldErrors({})

    setAssignmentSubmitting(true)
    setAssignmentError(null)
    setAssignmentSuccess(null)

    try {
      const assignmentResponse = await api.post<AssignStageResponse>('/api/stages/assign', {
        missionId: assignmentForm.missionId,
        internId: targetInternId,
        startDate: toIsoDate(assignmentForm.startDate),
        endDate: toIsoDate(assignmentForm.endDate),
      })

      const internshipId = asNonEmptyString(assignmentResponse.missionId)

      const followUpErrors: string[] = []

      if (assignmentForm.departmentId || assignmentForm.internshipTypeId) {
        if (!internshipId) {
          followUpErrors.push('Internship update step failed: missing internship id from assignment response.')
        } else {
          const internshipUpdatePayload: Record<string, string> = {}
          if (assignmentForm.departmentId) {
            internshipUpdatePayload.departmentId = assignmentForm.departmentId
          }

          if (assignmentForm.internshipTypeId) {
            internshipUpdatePayload.internshipTypeId = assignmentForm.internshipTypeId
          }

          try {
            await api.patch(`/api/internships/${internshipId}`, internshipUpdatePayload)
          } catch (error) {
            followUpErrors.push(`Internship update step failed: ${toDashboardErrorMessage(error)}`)
          }
        }
      }

      if (assignmentForm.skillIds.length > 0) {
        try {
          await api.put(`/api/interns/${targetInternId}/skills`, {
            skillIds: assignmentForm.skillIds,
          })
        } catch (error) {
          followUpErrors.push(`Skills update step failed: ${toDashboardErrorMessage(error)}`)
        }
      }

      await Promise.resolve(onAssignmentSuccess())

      if (followUpErrors.length > 0) {
        setAssignmentError(
          `${followUpErrors.join(' ')} Assignment created but additional details could not be saved. Please edit the internship manually.`,
        )
        return
      }

      setAssignmentSuccess('Intern successfully assigned')
      window.setTimeout(() => onClose(), 300)
    } catch (error) {
      setAssignmentError(`Assignment step failed: ${toDashboardErrorMessage(error)}`)
    } finally {
      setAssignmentSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('dashboard.manager.internDetails.section.assignIntern')}>
      {assignmentOptionsLoading ? (
        <Skeleton height="320px" />
      ) : (
        <form
          className="modal-form"
          onSubmit={(event) => {
            event.preventDefault()
            void submitAssignment()
          }}
        >
          {assignmentOptionsError && <p className="intern-modal-warning">{assignmentOptionsError}</p>}
          {departmentsError && <p className="intern-modal-warning">{departmentsError}</p>}

          <div className="admin-form-grid admin-form-grid-two">
            <div className="form-field">
              <label htmlFor="assign-mission">{t('dashboard.manager.internDetails.label.mission')}</label>
              <select
                id="assign-mission"
                value={assignmentForm.missionId}
                onChange={(event) => setAssignmentForm((previous) => ({
                  ...previous,
                  missionId: event.target.value,
                }))}
                required
              >
                <option value="">{t('dashboard.manager.internDetails.selectMission')}</option>
                {missionOptions.map((mission) => (
                  <option key={mission.id} value={mission.id}>
                    {mission.title}
                    {mission.supervisorName ? ` - ${mission.supervisorName}` : ''}
                    {mission.status ? ` (${mission.status})` : ''}
                  </option>
                ))}
              </select>
              {assignmentFieldErrors.missionId && <p className="form-error">{assignmentFieldErrors.missionId}</p>}
            </div>

            <div className="form-field">
              <label htmlFor="assign-department">{t('dashboard.manager.internDetails.label.department')}</label>
              <select
                id="assign-department"
                value={assignmentForm.departmentId}
                onChange={(event) => setAssignmentForm((previous) => ({
                  ...previous,
                  departmentId: event.target.value,
                }))}
                disabled={loadingDepartments}
              >
                <option value="">{t('dashboard.manager.internDetails.selectDepartment')}</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="admin-form-grid admin-form-grid-two">
            <div className="form-field">
              <label htmlFor="assign-type">{t('dashboard.manager.internDetails.label.internshipType')}</label>
              <select
                id="assign-type"
                value={assignmentForm.internshipTypeId}
                onChange={(event) => setAssignmentForm((previous) => ({
                  ...previous,
                  internshipTypeId: event.target.value,
                }))}
              >
                <option value="">{t('dashboard.manager.internDetails.selectInternshipType')}</option>
                {typeOptions.map((typeOption) => (
                  <option key={typeOption.id} value={typeOption.id}>{typeOption.name}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="assign-start-date">{t('dashboard.manager.internDetails.label.startDate')}</label>
              <input
                id="assign-start-date"
                type="date"
                value={assignmentForm.startDate}
                onChange={(event) => setAssignmentForm((previous) => ({
                  ...previous,
                  startDate: event.target.value,
                }))}
                required
              />
              {assignmentFieldErrors.startDate && <p className="form-error">{assignmentFieldErrors.startDate}</p>}
            </div>
          </div>

          <div className="admin-form-grid admin-form-grid-two">
            <div className="form-field">
              <label htmlFor="assign-end-date">{t('dashboard.manager.internDetails.label.endDate')}</label>
              <input
                id="assign-end-date"
                type="date"
                value={assignmentForm.endDate}
                onChange={(event) => setAssignmentForm((previous) => ({
                  ...previous,
                  endDate: event.target.value,
                }))}
                required
              />
              {assignmentFieldErrors.endDate && <p className="form-error">{assignmentFieldErrors.endDate}</p>}
            </div>
          </div>

          <div className="form-field">
            <label>{t('dashboard.manager.internDetails.label.skills')}</label>
            {skillOptions.length === 0 ? (
              <p className="intern-modal-muted">{t('dashboard.manager.internDetails.noSkillOptions')}</p>
            ) : (
              <div className="intern-modal-chip-list" role="list" aria-label={t('dashboard.manager.internDetails.aria.availableSkills')}>
                {skillOptions.map((skillOption) => {
                  const isSelected = assignmentForm.skillIds.includes(skillOption.id)
                  return (
                    <button
                      key={skillOption.id}
                      type="button"
                      role="listitem"
                      className={`intern-modal-skill-chip ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => toggleSkill(skillOption.id)}
                    >
                      {skillOption.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {assignmentError && <p className="form-error">{assignmentError}</p>}
          {assignmentSuccess && <p className="intern-modal-success">{assignmentSuccess}</p>}

          <div className="modal-actions">
            <DashboardButton
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
            > {t('dashboard.manager.internDetails.cancel')} </DashboardButton>
            <DashboardButton type="submit" variant="primary" size="md" loading={assignmentSubmitting}> {t('dashboard.manager.internDetails.saveAssignment')} </DashboardButton>
          </div>
        </form>
      )}
    </Modal>
  )
}

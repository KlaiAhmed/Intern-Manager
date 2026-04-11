import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { getCsrfCookieToken } from '../../../../lib/auth'
import { apiFetch } from '../../../../lib/apiClient'
import { DashboardButton } from '../../components/DashboardButton'
import { ErrorState } from '../../components/ErrorState'
import { Modal } from '../../components/Modal'
import { Skeleton } from '../../components/Skeleton'
import { StatusBadge } from '../../components/StatusBadge'
import { useDashboardApi } from '../../hooks/useDashboardApi'
import { toDashboardErrorMessage } from '../../shared/utils/errorMessage'
import { toDateInputValue, toIsoDate } from '../../shared/utils/operations'
import { asNonEmptyString } from './utils'
import type { Department, Intern, PagedResponse } from './types'

interface InternDetailsModalProps {
  isOpen: boolean
  intern: Intern | null
  onClose: () => void
  getInitials: (name: string) => string
  departments: Department[]
  loadingDepartments: boolean
  departmentsError: string | null
  onAssignmentSuccess: () => Promise<void> | void
}

interface InternDetailsPayload {
  id?: string
  firstName?: string
  lastName?: string
  fullName?: string
  email?: string
  status?: string
  accountStatus?: string
  verificationStatus?: string
  cvFileUrl?: string | null
  startDate?: string | null
  endDate?: string | null
  phone?: string | null
  school?: string | null
  specialty?: string | null
  level?: string | null
  skills?: InternSkillPayload[]
  currentInternship?: InternCurrentInternshipPayload | null
}

interface InternSkillPayload {
  id?: string
  name?: string
}

interface InternCurrentInternshipSupervisorPayload {
  id?: string
  name?: string
  email?: string
}

interface InternCurrentInternshipMissionPayload {
  id?: string
  title?: string
}

interface InternCurrentInternshipPayload {
  id?: string
  type?: string | null
  department?: string | null
  startDate?: string | null
  endDate?: string | null
  status?: string
  supervisor?: InternCurrentInternshipSupervisorPayload | null
  mission?: InternCurrentInternshipMissionPayload | null
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

function toDisplayLabel(value: string): string {
  const normalized = value.trim()
  if (!normalized) return 'Unknown'

  return normalized
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter((token) => token.length > 0)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(' ')
}

function toStatusTone(rawValue: string): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  const normalized = rawValue.trim().toLowerCase().replace(/[_-]/g, ' ')

  if (!normalized || normalized === 'unknown') return 'neutral'
  if (normalized.includes('pending') || normalized.includes('incomplete')) return 'warning'
  if (normalized.includes('active') || normalized.includes('verified') || normalized.includes('approved')) return 'success'
  if (normalized.includes('rejected') || normalized.includes('denied')) return 'danger'

  return 'info'
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

async function readResponseMessage(response: Response): Promise<string | null> {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    try {
      const payload = await response.json() as Record<string, unknown>
      const message = typeof payload.message === 'string' ? payload.message.trim() : ''
      if (message) {
        return message
      }

      const title = typeof payload.title === 'string' ? payload.title.trim() : ''
      if (title) {
        return title
      }
    } catch {
      return null
    }
  }

  try {
    const responseText = await response.text()
    return responseText.trim() || null
  } catch {
    return null
  }
}

export function InternDetailsModal({
  isOpen,
  intern,
  onClose,
  getInitials,
  departments,
  loadingDepartments,
  departmentsError,
  onAssignmentSuccess,
}: InternDetailsModalProps) {
  const { t } = useI18n()
  const api = useDashboardApi()

  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [internDetails, setInternDetails] = useState<InternDetailsPayload | null>(null)

  const [cvLoading, setCvLoading] = useState(false)
  const [cvError, setCvError] = useState<string | null>(null)

  const [showAssignSection, setShowAssignSection] = useState(false)
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

  const loadInternDetails = useCallback(async (internId: string) => {
    setDetailsLoading(true)
    setDetailsError(null)

    try {
      const internPayload = await api.get<InternDetailsPayload>(`/api/interns/${internId}`)

      const profileStartDate = asNonEmptyString(internPayload.startDate)
      const profileEndDate = asNonEmptyString(internPayload.endDate)
      const internshipStartDate = asNonEmptyString(internPayload.currentInternship?.startDate)
      const internshipEndDate = asNonEmptyString(internPayload.currentInternship?.endDate)
      const selectedSkillIds = (internPayload.skills ?? [])
        .map((skill) => asNonEmptyString(skill.id))
        .filter((skillId) => skillId.length > 0)

      setInternDetails(internPayload)
      setAssignmentForm({
        missionId: '',
        departmentId: '',
        internshipTypeId: '',
        startDate: toDateInputValue(profileStartDate || internshipStartDate || null),
        endDate: toDateInputValue(profileEndDate || internshipEndDate || null),
        skillIds: selectedSkillIds,
      })
      setAssignmentFieldErrors({})
    } catch (error) {
      setDetailsError(toDashboardErrorMessage(error))
      setInternDetails(null)
    } finally {
      setDetailsLoading(false)
    }
  }, [api])

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

    void loadInternDetails(targetInternId)
    void loadAssignmentOptions()
  }, [isOpen, loadAssignmentOptions, loadInternDetails, targetInternId])

  useEffect(() => {
    if (!isOpen) {
      setShowAssignSection(false)
      setAssignmentError(null)
      setAssignmentSuccess(null)
      setCvError(null)
      setAssignmentFieldErrors({})
      setAssignmentForm(defaultAssignmentForm)
    }
  }, [isOpen])

  const internSkillItems = useMemo(() => {
    return (internDetails?.skills ?? [])
      .map((skill) => ({
        id: asNonEmptyString(skill.id),
        name: asNonEmptyString(skill.name),
      }))
      .filter((skill) => skill.id.length > 0 && skill.name.length > 0)
  }, [internDetails?.skills])

  const hasCv = useMemo(() => {
    return Boolean(asNonEmptyString(internDetails?.cvFileUrl) || asNonEmptyString(intern?.cvFileUrl))
  }, [internDetails?.cvFileUrl, intern?.cvFileUrl])

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

  const handleViewCv = async () => {
    if (!targetInternId) {
      return
    }

    setCvLoading(true)
    setCvError(null)

    try {
      const csrfToken = getCsrfCookieToken()
      const headers: Record<string, string> = {}
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken
      }

      const response = await apiFetch(`/api/interns/${targetInternId}/cv`, {
        method: 'GET',
        headers,
        omitJsonAcceptHeader: true,
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('No CV on file for this intern')
        }

        if (response.status === 403) {
          throw new Error('You do not have permission to view this CV')
        }

        const message = await readResponseMessage(response)
        throw new Error(message || 'Unable to open this CV.')
      }

      const contentType = response.headers.get('content-type') ?? ''
      if (contentType.includes('application/json') || contentType.includes('text/plain')) {
        const rawPayload = (await response.text()).trim()

        try {
          const jsonPayload = JSON.parse(rawPayload) as Record<string, unknown>
          const rawUrl = typeof jsonPayload.url === 'string' ? jsonPayload.url.trim() : ''
          if (rawUrl) {
            window.open(rawUrl, '_blank', 'noopener,noreferrer')
            return
          }
        } catch {
          const normalizedUrl = rawPayload.replace(/^"|"$/g, '')
          if (/^https?:\/\//i.test(normalizedUrl) || normalizedUrl.startsWith('/')) {
            window.open(normalizedUrl, '_blank', 'noopener,noreferrer')
            return
          }
        }
      }

      const cvBlob = await response.blob()
      const blobUrl = URL.createObjectURL(cvBlob)
      window.open(blobUrl, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    } catch (error) {
      if (error instanceof Error && error.message.trim()) {
        setCvError(error.message)
      } else {
        setCvError('Unable to open this CV.')
      }

      if (!(error instanceof Error && (error.message.includes('No CV') || error.message.includes('permission')))) {
        // Keep diagnostics for unexpected failures without exposing internal details to users.
        console.error('Failed to open intern CV', error)
      }
    } finally {
      setCvLoading(false)
    }
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
      await loadInternDetails(targetInternId)

      if (followUpErrors.length > 0) {
        setAssignmentError(
          `${followUpErrors.join(' ')} Assignment created but additional details could not be saved. Please edit the internship manually.`,
        )
        return
      }

      setShowAssignSection(false)
      setAssignmentSuccess('Intern successfully assigned')
      window.setTimeout(() => onClose(), 300)
    } catch (error) {
      setAssignmentError(`Assignment step failed: ${toDashboardErrorMessage(error)}`)
    } finally {
      setAssignmentSubmitting(false)
    }
  }

  const internDisplayName = asNonEmptyString(internDetails?.fullName) || asNonEmptyString(intern?.name)
  const internshipStatusValue = asNonEmptyString(internDetails?.currentInternship?.status)
  const accountStatusValue = asNonEmptyString(internDetails?.accountStatus) || asNonEmptyString(intern?.accountStatus)
  const verificationStatusValue = asNonEmptyString(internDetails?.verificationStatus) || asNonEmptyString(intern?.verificationStatus) || 'Unknown'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={internDisplayName || t('dashboard.manager.internDetails.title')}>
      {!intern ? null : detailsLoading ? (
        <Skeleton height="320px" />
      ) : detailsError ? (
        <ErrorState
          message={detailsError}
          onRetry={() => {
            if (targetInternId) {
              void loadInternDetails(targetInternId)
            }
          }}
        />
      ) : (
        <div className="intern-modal-content">
          <div className="intern-modal-header">
            <span className="intern-modal-avatar" aria-hidden="true">{getInitials(internDisplayName || intern.name)}</span>
            <div className="intern-modal-info">
              <h3>{internDisplayName || '-'}</h3>
              <p className="intern-modal-email">{asNonEmptyString(internDetails?.email) || intern.email || '-'}</p>
            </div>
          </div>

          <div className="intern-modal-block">
            <h4 className="intern-modal-section-title">{t('dashboard.manager.internDetails.section.personalInfo')}</h4>
            <div className="admin-modal-details-grid">
              <div>
                <h3>{t('dashboard.manager.internDetails.label.name')}</h3>
                <p>{internDisplayName || '—'}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.email')}</h3>
                <p>{asNonEmptyString(internDetails?.email) || intern.email || '—'}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.phone')}</h3>
                <p>{asNonEmptyString(internDetails?.phone) || '—'}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.school')}</h3>
                <p>{asNonEmptyString(internDetails?.school) || '—'}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.specialty')}</h3>
                <p>{asNonEmptyString(internDetails?.specialty) || '—'}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.level')}</h3>
                <p>{asNonEmptyString(internDetails?.level) || '—'}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.firstName')}</h3>
                <p>{asNonEmptyString(internDetails?.firstName) || '—'}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.lastName')}</h3>
                <p>{asNonEmptyString(internDetails?.lastName) || '—'}</p>
              </div>
            </div>
          </div>

          <div className="intern-modal-block">
            <h4 className="intern-modal-section-title">{t('dashboard.manager.internDetails.section.internshipInfo')}</h4>
            <div className="admin-modal-details-grid">
              <div>
                <h3>{t('dashboard.manager.internDetails.label.type')}</h3>
                <p>{asNonEmptyString(internDetails?.currentInternship?.type) || asNonEmptyString(intern?.internshipType) || '—'}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.department')}</h3>
                <p>{asNonEmptyString(internDetails?.currentInternship?.department) || intern.department || '—'}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.startDate')}</h3>
                <p>{toDateInputValue(asNonEmptyString(internDetails?.startDate) || asNonEmptyString(internDetails?.currentInternship?.startDate) || null) || '—'}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.endDate')}</h3>
                <p>{toDateInputValue(asNonEmptyString(internDetails?.endDate) || asNonEmptyString(internDetails?.currentInternship?.endDate) || null) || '—'}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.internshipStatus')}</h3>
                <p>{internshipStatusValue ? toDisplayLabel(internshipStatusValue) : '—'}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.accountStatus')}</h3>
                <StatusBadge
                  label={toDisplayLabel(accountStatusValue || 'Unknown')}
                  tone={toStatusTone(accountStatusValue || 'Unknown')}
                  size="sm"
                />
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.verificationStatus')}</h3>
                <StatusBadge
                  label={toDisplayLabel(verificationStatusValue)}
                  tone={toStatusTone(verificationStatusValue)}
                  size="sm"
                />
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.cvUrl')}</h3>
                <p>{asNonEmptyString(internDetails?.cvFileUrl) || '—'}</p>
              </div>
            </div>
          </div>

          <div className="intern-modal-block">
            <h4 className="intern-modal-section-title">{t('dashboard.manager.internDetails.section.skills')}</h4>
            {internSkillItems.length > 0 ? (
              <div className="intern-modal-chip-list" role="list" aria-label={t('dashboard.manager.internDetails.aria.selectedSkills')}>
                {internSkillItems.map((skill) => (
                  <span key={skill.id} role="listitem" className="dash-status-chip dash-status-chip-info dash-status-chip-sm">
                    {skill.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="intern-modal-muted">{t('dashboard.manager.internDetails.noSkills')}</p>
            )}
          </div>

          <div className="intern-modal-block">
            <h4 className="intern-modal-section-title">{t('dashboard.manager.internDetails.section.supervisorMission')}</h4>
            <div className="admin-modal-details-grid">
              <div>
                <h3>{t('dashboard.manager.internDetails.label.mission')}</h3>
                <p>{asNonEmptyString(internDetails?.currentInternship?.mission?.title) || t('dashboard.manager.internDetails.notAssigned')}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.supervisor')}</h3>
                <p>{asNonEmptyString(internDetails?.currentInternship?.supervisor?.name) || t('dashboard.manager.internDetails.notAssigned')}</p>
              </div>
            </div>
          </div>

          <div className="intern-modal-block">
            <h4 className="intern-modal-section-title">{t('dashboard.manager.internDetails.section.additionalFields')}</h4>
            <div className="admin-modal-details-grid">
              <div>
                <h3>{t('dashboard.manager.internDetails.label.internId')}</h3>
                <p>{targetInternId || '-'}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.progress')}</h3>
                <p>{intern.progress}%</p>
              </div>
            </div>
          </div>

          <div className="intern-modal-actions">
            <DashboardButton variant="secondary" onClick={onClose}>
              {t('dashboard.manager.internDetails.close')}
            </DashboardButton>
            <DashboardButton
              variant="primary"
              size="md"
              loading={cvLoading}
              disabled={!hasCv || cvLoading}
              title={!hasCv ? t('dashboard.manager.internDetails.noCvUploaded') : undefined}
              onClick={() => void handleViewCv()}
            >
              {t('dashboard.manager.internDetails.viewCv')}
            </DashboardButton>
            <DashboardButton
              variant="primary"
              size="md"
              onClick={() => setShowAssignSection((previous) => !previous)}
            >
              {showAssignSection ? t('dashboard.manager.internDetails.hideAssignment') : t('dashboard.manager.internDetails.assignIntern')}
            </DashboardButton>
          </div>

          {cvError && <p className="form-error">{cvError}</p>}
          {assignmentSuccess && <p className="intern-modal-success">{assignmentSuccess}</p>}

          {showAssignSection && (
            <section className="intern-modal-assignment">
              <h4 className="intern-modal-section-title">{t('dashboard.manager.internDetails.section.assignIntern')}</h4>

              {assignmentOptionsLoading ? (
                <Skeleton height="220px" />
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
                      <label htmlFor="manager-assign-mission">{t('dashboard.manager.internDetails.label.mission')}</label>
                      <select
                        id="manager-assign-mission"
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
                      <label htmlFor="manager-assign-department">{t('dashboard.manager.internDetails.label.department')}</label>
                      <select
                        id="manager-assign-department"
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
                      <label htmlFor="manager-assign-type">{t('dashboard.manager.internDetails.label.internshipType')}</label>
                      <select
                        id="manager-assign-type"
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
                      <label htmlFor="manager-assign-start-date">{t('dashboard.manager.internDetails.label.startDate')}</label>
                      <input
                        id="manager-assign-start-date"
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
                      <label htmlFor="manager-assign-end-date">{t('dashboard.manager.internDetails.label.endDate')}</label>
                      <input
                        id="manager-assign-end-date"
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

                  <div className="modal-actions">
                    <DashboardButton
                      type="button"
                      variant="secondary"
                      size="md"
                      onClick={() => setShowAssignSection(false)}
                    > {t('dashboard.manager.internDetails.cancel')} </DashboardButton>
                    <DashboardButton type="submit" variant="primary" size="md" loading={assignmentSubmitting}> {t('dashboard.manager.internDetails.saveAssignment')} </DashboardButton>
                  </div>
                </form>
              )}
            </section>
          )}
        </div>
      )}
    </Modal>
  )
}

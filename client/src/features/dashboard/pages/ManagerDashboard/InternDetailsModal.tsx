import { useCallback, useEffect, useMemo, useState } from 'react'
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
import type { Department, Intern, InternshipRecord, PagedResponse } from './types'

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
  department: string
  internshipType: string
  startDate: string
  endDate: string
  skillIds: string[]
}

const defaultAssignmentForm: AssignmentFormState = {
  missionId: '',
  department: '',
  internshipType: '',
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
  const api = useDashboardApi()

  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [internDetails, setInternDetails] = useState<InternDetailsPayload | null>(null)
  const [internshipDetails, setInternshipDetails] = useState<InternshipRecord | null>(null)

  const [cvLoading, setCvLoading] = useState(false)
  const [cvError, setCvError] = useState<string | null>(null)

  const [showAssignSection, setShowAssignSection] = useState(false)
  const [assignmentForm, setAssignmentForm] = useState<AssignmentFormState>(defaultAssignmentForm)
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
      const [internPayload, internshipsPayload] = await Promise.all([
        api.get<InternDetailsPayload>(`/api/interns/${internId}`),
        api.get<PagedResponse<InternshipRecord>>('/api/internships?page=1&limit=500'),
      ])

      const matchingInternship = (internshipsPayload.data ?? []).find((entry) => asNonEmptyString(entry.internId) === internId) ?? null

      const profileStartDate = asNonEmptyString(internPayload.startDate)
      const profileEndDate = asNonEmptyString(internPayload.endDate)
      const internshipStartDate = asNonEmptyString(matchingInternship?.startDate)
      const internshipEndDate = asNonEmptyString(matchingInternship?.endDate)

      setInternDetails(internPayload)
      setInternshipDetails(matchingInternship)
      setAssignmentForm({
        missionId: '',
        department: asNonEmptyString(matchingInternship?.department),
        internshipType: asNonEmptyString(matchingInternship?.type),
        startDate: toDateInputValue(profileStartDate || internshipStartDate || null),
        endDate: toDateInputValue(profileEndDate || internshipEndDate || null),
        skillIds: [],
      })
    } catch (error) {
      setDetailsError(toDashboardErrorMessage(error))
      setInternDetails(null)
      setInternshipDetails(null)
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
      setAssignmentForm(defaultAssignmentForm)
    }
  }, [isOpen])

  const selectedSkillNames = useMemo(() => {
    const namesById = new Map(skillOptions.map((skill) => [skill.id, skill.name]))
    return assignmentForm.skillIds
      .map((skillId) => namesById.get(skillId) || '')
      .filter((name): name is string => name.length > 0)
  }, [assignmentForm.skillIds, skillOptions])

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
        const message = await readResponseMessage(response)
        throw new Error(message || 'Unable to open this CV.')
      }

      const cvBlob = await response.blob()
      const blobUrl = URL.createObjectURL(cvBlob)
      window.open(blobUrl, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    } catch (error) {
      setCvError(toDashboardErrorMessage(error))
    } finally {
      setCvLoading(false)
    }
  }

  const submitAssignment = async () => {
    if (!targetInternId) {
      setAssignmentError('Unable to resolve intern id.')
      return
    }

    if (!assignmentForm.missionId.trim()) {
      setAssignmentError('Mission is required.')
      return
    }

    if (!assignmentForm.startDate || !assignmentForm.endDate) {
      setAssignmentError('Start date and end date are required.')
      return
    }

    if (new Date(assignmentForm.endDate) < new Date(assignmentForm.startDate)) {
      setAssignmentError('End date must be greater than or equal to start date.')
      return
    }

    setAssignmentSubmitting(true)
    setAssignmentError(null)
    setAssignmentSuccess(null)

    try {
      await api.post('/api/stages/assign', {
        missionId: assignmentForm.missionId,
        internId: targetInternId,
        startDate: toIsoDate(assignmentForm.startDate),
        endDate: toIsoDate(assignmentForm.endDate),
      })

      const followUpWarnings: string[] = []

      const internshipUpdatePayload: Record<string, string> = {}
      if (assignmentForm.department.trim()) {
        internshipUpdatePayload.department = assignmentForm.department.trim()
      }
      if (assignmentForm.internshipType.trim()) {
        internshipUpdatePayload.type = assignmentForm.internshipType.trim()
      }

      if (Object.keys(internshipUpdatePayload).length > 0) {
        if (asNonEmptyString(internshipDetails?.id)) {
          try {
            await api.patch(`/api/internships/${asNonEmptyString(internshipDetails?.id)}`, internshipUpdatePayload)
          } catch (error) {
            followUpWarnings.push(`Internship metadata update failed: ${toDashboardErrorMessage(error)}`)
          }
        } else {
          followUpWarnings.push('No existing internship record was found for department/type update.')
        }
      }

      if (selectedSkillNames.length > 0) {
        try {
          await api.patch(`/api/missions/${assignmentForm.missionId}`, {
            skills: selectedSkillNames,
          })
        } catch (error) {
          followUpWarnings.push(`Mission skills update failed: ${toDashboardErrorMessage(error)}`)
        }
      }

      await Promise.resolve(onAssignmentSuccess())
      await loadInternDetails(targetInternId)

      setShowAssignSection(false)
      setAssignmentSuccess(
        followUpWarnings.length > 0
          ? `Intern assigned with warnings: ${followUpWarnings.join(' ')}`
          : 'Intern assignment completed successfully.',
      )
    } catch (error) {
      setAssignmentError(toDashboardErrorMessage(error))
    } finally {
      setAssignmentSubmitting(false)
    }
  }

  const internDisplayName = asNonEmptyString(internDetails?.fullName) || asNonEmptyString(intern?.name)
  const internshipStatusValue = asNonEmptyString(internshipDetails?.status)
  const accountStatusValue = asNonEmptyString(internDetails?.accountStatus) || asNonEmptyString(intern?.accountStatus)
  const verificationStatusValue = asNonEmptyString(internDetails?.verificationStatus) || asNonEmptyString(intern?.verificationStatus) || 'Unknown'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={internDisplayName || 'Intern details'}>
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
            <h4 className="intern-modal-section-title">Personal Info</h4>
            <div className="admin-modal-details-grid">
              <div>
                <h3>Name</h3>
                <p>{internDisplayName || '-'}</p>
              </div>
              <div>
                <h3>Email</h3>
                <p>{asNonEmptyString(internDetails?.email) || intern.email || '-'}</p>
              </div>
              <div>
                <h3>Phone</h3>
                <p>-</p>
              </div>
              <div>
                <h3>School</h3>
                <p>-</p>
              </div>
              <div>
                <h3>Specialty</h3>
                <p>-</p>
              </div>
              <div>
                <h3>Level</h3>
                <p>-</p>
              </div>
              <div>
                <h3>First name</h3>
                <p>{asNonEmptyString(internDetails?.firstName) || '-'}</p>
              </div>
              <div>
                <h3>Last name</h3>
                <p>{asNonEmptyString(internDetails?.lastName) || '-'}</p>
              </div>
            </div>
          </div>

          <div className="intern-modal-block">
            <h4 className="intern-modal-section-title">Internship Info</h4>
            <div className="admin-modal-details-grid">
              <div>
                <h3>Type</h3>
                <p>{asNonEmptyString(internshipDetails?.type) || asNonEmptyString(intern?.internshipType) || '-'}</p>
              </div>
              <div>
                <h3>Department</h3>
                <p>{asNonEmptyString(internshipDetails?.department) || intern.department || '-'}</p>
              </div>
              <div>
                <h3>Start Date</h3>
                <p>{toDateInputValue(asNonEmptyString(internDetails?.startDate) || asNonEmptyString(internshipDetails?.startDate) || null) || '-'}</p>
              </div>
              <div>
                <h3>End Date</h3>
                <p>{toDateInputValue(asNonEmptyString(internDetails?.endDate) || asNonEmptyString(internshipDetails?.endDate) || null) || '-'}</p>
              </div>
              <div>
                <h3>Internship Status</h3>
                <p>{internshipStatusValue ? toDisplayLabel(internshipStatusValue) : '-'}</p>
              </div>
              <div>
                <h3>Account Status</h3>
                <StatusBadge
                  label={toDisplayLabel(accountStatusValue || 'Unknown')}
                  tone={toStatusTone(accountStatusValue || 'Unknown')}
                  size="sm"
                />
              </div>
              <div>
                <h3>Verification Status</h3>
                <StatusBadge
                  label={toDisplayLabel(verificationStatusValue)}
                  tone={toStatusTone(verificationStatusValue)}
                  size="sm"
                />
              </div>
              <div>
                <h3>CV URL</h3>
                <p>{asNonEmptyString(internDetails?.cvFileUrl) || '-'}</p>
              </div>
            </div>
          </div>

          <div className="intern-modal-block">
            <h4 className="intern-modal-section-title">Skills</h4>
            {selectedSkillNames.length > 0 ? (
              <div className="intern-modal-chip-list" role="list" aria-label="Selected skills">
                {selectedSkillNames.map((skillName) => (
                  <span key={skillName} role="listitem" className="dash-status-chip dash-status-chip-info dash-status-chip-sm">
                    {skillName}
                  </span>
                ))}
              </div>
            ) : (
              <p className="intern-modal-muted">No intern-specific skills were returned by the current manager-accessible detail endpoint.</p>
            )}
          </div>

          <div className="intern-modal-block">
            <h4 className="intern-modal-section-title">Supervisor & Mission</h4>
            <div className="admin-modal-details-grid">
              <div>
                <h3>Mission</h3>
                <p>{asNonEmptyString(internshipDetails?.missionTitle) || intern.missionTitle || '-'}</p>
              </div>
              <div>
                <h3>Supervisor</h3>
                <p>{asNonEmptyString(internshipDetails?.supervisorName) || intern.supervisorName || '-'}</p>
              </div>
            </div>
          </div>

          <div className="intern-modal-block">
            <h4 className="intern-modal-section-title">Additional Fields</h4>
            <div className="admin-modal-details-grid">
              <div>
                <h3>Intern ID</h3>
                <p>{targetInternId || '-'}</p>
              </div>
              <div>
                <h3>Progress</h3>
                <p>{intern.progress}%</p>
              </div>
            </div>
          </div>

          <div className="intern-modal-actions">
            <DashboardButton variant="secondary" onClick={onClose}>
              Close
            </DashboardButton>
            <DashboardButton
              variant="primary"
              size="md"
              loading={cvLoading}
              disabled={!hasCv || cvLoading}
              title={!hasCv ? 'No CV uploaded' : undefined}
              onClick={() => void handleViewCv()}
            >
              View CV
            </DashboardButton>
            <DashboardButton
              variant="primary"
              size="md"
              onClick={() => setShowAssignSection((previous) => !previous)}
            >
              {showAssignSection ? 'Hide Assignment' : 'Assign Intern'}
            </DashboardButton>
          </div>

          {cvError && <p className="form-error">{cvError}</p>}
          {assignmentSuccess && <p className="intern-modal-success">{assignmentSuccess}</p>}

          {showAssignSection && (
            <section className="intern-modal-assignment">
              <h4 className="intern-modal-section-title">Assign Intern</h4>

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
                      <label htmlFor="manager-assign-mission">Mission</label>
                      <select
                        id="manager-assign-mission"
                        value={assignmentForm.missionId}
                        onChange={(event) => setAssignmentForm((previous) => ({
                          ...previous,
                          missionId: event.target.value,
                        }))}
                        required
                      >
                        <option value="">Select mission</option>
                        {missionOptions.map((mission) => (
                          <option key={mission.id} value={mission.id}>
                            {mission.title}
                            {mission.supervisorName ? ` - ${mission.supervisorName}` : ''}
                            {mission.status ? ` (${mission.status})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label htmlFor="manager-assign-department">Department</label>
                      <select
                        id="manager-assign-department"
                        value={assignmentForm.department}
                        onChange={(event) => setAssignmentForm((previous) => ({
                          ...previous,
                          department: event.target.value,
                        }))}
                        disabled={loadingDepartments}
                      >
                        <option value="">All Departments</option>
                        {departments.map((department) => (
                          <option key={department.id} value={department.name}>{department.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="admin-form-grid admin-form-grid-two">
                    <div className="form-field">
                      <label htmlFor="manager-assign-type">Internship Type</label>
                      <select
                        id="manager-assign-type"
                        value={assignmentForm.internshipType}
                        onChange={(event) => setAssignmentForm((previous) => ({
                          ...previous,
                          internshipType: event.target.value,
                        }))}
                      >
                        <option value="">Select internship type</option>
                        {typeOptions.map((typeOption) => (
                          <option key={typeOption.id} value={typeOption.name}>{typeOption.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field">
                      <label htmlFor="manager-assign-start-date">Start Date</label>
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
                    </div>
                  </div>

                  <div className="admin-form-grid admin-form-grid-two">
                    <div className="form-field">
                      <label htmlFor="manager-assign-end-date">End Date</label>
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
                    </div>
                  </div>

                  <div className="form-field">
                    <label>Skills</label>
                    {skillOptions.length === 0 ? (
                      <p className="intern-modal-muted">No skill options available.</p>
                    ) : (
                      <div className="intern-modal-chip-list" role="list" aria-label="Available skills">
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
                    >
                      Cancel
                    </DashboardButton>
                    <DashboardButton type="submit" variant="primary" size="md" loading={assignmentSubmitting}>
                      Save Assignment
                    </DashboardButton>
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

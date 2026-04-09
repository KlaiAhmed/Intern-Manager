import { useCallback, useEffect, useMemo, useState } from 'react'
import { Input } from '../../../../components/ui/Input'
import { DashboardButton } from '../../components/DashboardButton'
import { Edit, Plus, Search, Trash2 } from '../../components/IconComponents'
import { ErrorState } from '../../components/ErrorState'
import { Modal } from '../../components/Modal'
import { Skeleton } from '../../components/Skeleton'
import { useDashboardApi } from '../../hooks/useDashboardApi'
import type {
  DashboardUser,
  DashboardUserApi,
  InternshipApi,
  InternshipDetailsTab,
  InternshipFormState,
  InternshipHistoryApi,
  InternshipHistoryRecord,
  InternshipRecord,
  PagedResponse,
  ReferentialApi,
  ReferentialRecord,
} from '../types/operations'
import { defaultInternshipFormState } from '../types/operations'
import { toDashboardErrorMessage } from '../utils/errorMessage'
import {
  mapHistoryApi,
  mapInternshipApi,
  mapUserApi,
  parseReferentialResponse,
  toDateInputValue,
  toIsoDate,
} from '../utils/operations'
import styles from './OperationalInternshipsSection.module.css'

export function OperationalInternshipsSection() {
  const api = useDashboardApi()
  const pageSize = 10
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [internships, setInternships] = useState<InternshipRecord[]>([])
  const [supervisors, setSupervisors] = useState<DashboardUser[]>([])
  const [departments, setDepartments] = useState<ReferentialRecord[]>([])
  const [types, setTypes] = useState<ReferentialRecord[]>([])

  const [searchFilter, setSearchFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [startDateFilter, setStartDateFilter] = useState('')
  const [endDateFilter, setEndDateFilter] = useState('')
  const [page, setPage] = useState(1)

  const [formModalOpen, setFormModalOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [editingInternshipId, setEditingInternshipId] = useState<string | null>(null)
  const [formState, setFormState] = useState<InternshipFormState>(defaultInternshipFormState)

  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [detailsTab, setDetailsTab] = useState<InternshipDetailsTab>('details')
  const [selectedInternship, setSelectedInternship] = useState<InternshipRecord | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyItems, setHistoryItems] = useState<InternshipHistoryRecord[]>([])

  const loadReferenceData = useCallback(async () => {
    const [supervisorsPayload, departmentsPayload, typesPayload] = await Promise.all([
      api.get<PagedResponse<DashboardUserApi>>('/api/users?role=supervisor&page=1&limit=200'),
      api.get<ReferentialApi[] | PagedResponse<ReferentialApi>>('/api/admin/settings/departments'),
      api.get<ReferentialApi[] | PagedResponse<ReferentialApi>>('/api/admin/settings/internship-types'),
    ])

    const supervisorData = (supervisorsPayload.data ?? [])
      .map(mapUserApi)
      .filter((item): item is DashboardUser => item !== null)

    setSupervisors(supervisorData)
    setDepartments(parseReferentialResponse(departmentsPayload))
    setTypes(parseReferentialResponse(typesPayload))
  }, [api])

  const loadInternships = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', '1')
      params.set('limit', '250')

      if (statusFilter) {
        params.set('status', statusFilter)
      }

      if (departmentFilter) {
        params.set('department', departmentFilter)
      }

      const payload = await api.get<PagedResponse<InternshipApi>>(`/api/internships?${params.toString()}`)
      const mappedInternships = (payload.data ?? [])
        .map(mapInternshipApi)
        .filter((item): item is InternshipRecord => item !== null)

      setInternships(mappedInternships)
      setPage(1)
    } catch (requestError) {
      setError(toDashboardErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [api, departmentFilter, statusFilter])

  useEffect(() => {
    void (async () => {
      try {
        await loadReferenceData()
      } catch {
        // Non-blocking for main table rendering.
      }
    })()
  }, [loadReferenceData])

  useEffect(() => {
    void loadInternships()
  }, [loadInternships])

  const filteredInternships = useMemo(() => {
    const normalizedSearch = searchFilter.trim().toLowerCase()

    return internships.filter((internship) => {
      if (normalizedSearch) {
        const matchesSearch =
          internship.missionTitle.toLowerCase().includes(normalizedSearch)
          || (internship.internName ?? '').toLowerCase().includes(normalizedSearch)
          || (internship.supervisorName ?? '').toLowerCase().includes(normalizedSearch)

        if (!matchesSearch) {
          return false
        }
      }

      if (typeFilter && (internship.type ?? '') !== typeFilter) {
        return false
      }

      if (startDateFilter && internship.startDate) {
        const internshipStart = new Date(internship.startDate)
        const filterStart = new Date(`${startDateFilter}T00:00:00.000Z`)
        if (internshipStart < filterStart) {
          return false
        }
      }

      if (endDateFilter && internship.endDate) {
        const internshipEnd = new Date(internship.endDate)
        const filterEnd = new Date(`${endDateFilter}T23:59:59.999Z`)
        if (internshipEnd > filterEnd) {
          return false
        }
      }

      return true
    })
  }, [endDateFilter, internships, searchFilter, startDateFilter, typeFilter])

  const pagedInternships = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredInternships.slice(start, start + pageSize)
  }, [filteredInternships, page])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredInternships.length / pageSize))
  }, [filteredInternships.length])

  const openCreateModal = () => {
    setEditingInternshipId(null)
    setFormState(defaultInternshipFormState)
    setFormError(null)
    setFormModalOpen(true)
  }

  const openEditModal = (internship: InternshipRecord) => {
    setEditingInternshipId(internship.id)
    setFormState({
      missionTitle: internship.missionTitle,
      supervisorId: internship.supervisorId,
      coSupervisorId: internship.coSupervisorId ?? '',
      department: internship.department ?? '',
      type: internship.type ?? '',
      status: internship.status,
      startDate: toDateInputValue(internship.startDate),
      endDate: toDateInputValue(internship.endDate),
      objectives: internship.objectives,
    })
    setFormError(null)
    setFormModalOpen(true)
  }

  const saveInternship = async () => {
    if (!formState.supervisorId.trim()) {
      setFormError('Supervisor is required.')
      return
    }

    if (!formState.startDate || !formState.endDate) {
      setFormError('Start date and end date are required.')
      return
    }

    if (new Date(formState.endDate) <= new Date(formState.startDate)) {
      setFormError('End date must be after start date.')
      return
    }

    setFormSubmitting(true)
    setFormError(null)

    const payload: Record<string, string> = {
      supervisorId: formState.supervisorId.trim(),
      coSupervisorId: formState.coSupervisorId.trim(),
      department: formState.department.trim(),
      type: formState.type.trim(),
      status: formState.status.trim(),
      startDate: toIsoDate(formState.startDate),
      endDate: toIsoDate(formState.endDate),
      objectives: formState.objectives.trim(),
    }

    try {
      if (editingInternshipId) {
        await api.patch(`/api/internships/${editingInternshipId}`, payload)
      } else {
        await api.post('/api/internships', payload)
      }

      setFormModalOpen(false)
      setEditingInternshipId(null)
      setFormState(defaultInternshipFormState)
      await loadInternships()
    } catch (requestError) {
      setFormError(toDashboardErrorMessage(requestError))
    } finally {
      setFormSubmitting(false)
    }
  }

  const deleteInternship = async (internshipId: string) => {
    if (!window.confirm('Delete this internship record?')) {
      return
    }

    try {
      await api.del(`/api/internships/${internshipId}`)
      await loadInternships()
    } catch (requestError) {
      setError(toDashboardErrorMessage(requestError))
    }
  }

  const loadHistory = useCallback(async (internshipId: string) => {
    setHistoryLoading(true)
    setHistoryError(null)

    try {
      const payload = await api.get<PagedResponse<InternshipHistoryApi>>(`/api/internships/${internshipId}/history?page=1&limit=50`)
      const mappedHistory = (payload.data ?? [])
        .map(mapHistoryApi)
        .filter((item): item is InternshipHistoryRecord => item !== null)
      setHistoryItems(mappedHistory)
    } catch (requestError) {
      setHistoryError(toDashboardErrorMessage(requestError))
      setHistoryItems([])
    } finally {
      setHistoryLoading(false)
    }
  }, [api])

  const openDetailsModal = (internship: InternshipRecord) => {
    setSelectedInternship(internship)
    setDetailsModalOpen(true)
    setDetailsTab('details')
    setHistoryItems([])
    setHistoryError(null)
  }

  useEffect(() => {
    if (!detailsModalOpen || detailsTab !== 'history' || !selectedInternship) {
      return
    }

    void loadHistory(selectedInternship.id)
  }, [detailsModalOpen, detailsTab, loadHistory, selectedInternship])

  return (
    <section className={`${styles.root} super-admin-section admin-view-section`} id="section-internships">
      <header className="section-header-row">
        <div className="section-header-text">
          <h2 className="section-title">Internships</h2>
          <p className="section-subtitle">Create, update, and track internship assignments with full history visibility.</p>
        </div>
        <DashboardButton variant="primary" size="md" onClick={openCreateModal}>
          <Plus />
          <span>Create Internship</span>
        </DashboardButton>
      </header>

      <div className="admin-toolbar admin-toolbar-grid">
        <Input
          leftIcon={<Search />}
          placeholder="Search by internship, intern, or supervisor"
          value={searchFilter}
          onChange={(event) => setSearchFilter(event.target.value)}
          className="search-input-component"
        />

        <select className="dash-input dash-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">All Statuses</option>
          <option value="template">template</option>
          <option value="active">active</option>
          <option value="completed">completed</option>
          <option value="cancelled">cancelled</option>
        </select>

        <select className="dash-input dash-select" value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)}>
          <option value="">All Departments</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>{department.name}</option>
          ))}
        </select>

        <select className="dash-input dash-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
          <option value="">All Types</option>
          {types.map((type) => (
            <option key={type.id} value={type.name}>{type.name}</option>
          ))}
        </select>

        <input
          className="dash-input"
          type="date"
          value={startDateFilter}
          onChange={(event) => setStartDateFilter(event.target.value)}
          aria-label="Start date"
        />
        <input
          className="dash-input"
          type="date"
          value={endDateFilter}
          onChange={(event) => setEndDateFilter(event.target.value)}
          aria-label="End date"
        />
      </div>

      {loading ? (
        <div className="skeleton-block">
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadInternships()} />
      ) : filteredInternships.length === 0 ? (
        <div className="dash-empty">
          <h3 className="dash-empty-title">No internships found</h3>
          <p className="dash-empty-description">No internship records match the active filters.</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="dash-table super-admin-table">
              <thead>
                <tr>
                  <th>Mission</th>
                  <th>Intern</th>
                  <th>Supervisor</th>
                  <th>Department</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedInternships.map((internship) => (
                  <tr key={internship.id}>
                    <td>
                      <button
                        className="admin-link-button"
                        onClick={() => openDetailsModal(internship)}
                      >
                        {internship.missionTitle}
                      </button>
                    </td>
                    <td>{internship.internName ?? '-'}</td>
                    <td>{internship.supervisorName ?? '-'}</td>
                    <td>{internship.department ?? '-'}</td>
                    <td>{internship.type ?? '-'}</td>
                    <td>{internship.status}</td>
                    <td>
                      <div className="table-row-actions">
                        <button
                          className="action-btn action-btn-edit"
                          onClick={() => openEditModal(internship)}
                          aria-label="Edit internship"
                          title="Edit internship"
                        >
                          <Edit />
                        </button>
                        <button
                          className="action-btn action-btn-delete"
                          onClick={() => void deleteInternship(internship.id)}
                          aria-label="Delete internship"
                          title="Delete internship"
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="table-pagination">
              <DashboardButton variant="secondary" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                Previous
              </DashboardButton>
              <span className="pagination-info">Page {page} of {totalPages}</span>
              <DashboardButton
                variant="secondary"
                size="sm"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Next
              </DashboardButton>
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
        title={editingInternshipId ? 'Edit Internship' : 'Create Internship'}
      >
        <form
          className="modal-form"
          onSubmit={(event) => {
            event.preventDefault()
            void saveInternship()
          }}
        >
          <div className="form-field">
            <label htmlFor="internship-mission-title">Mission Title (optional)</label>
            <input
              id="internship-mission-title"
              type="text"
              value={formState.missionTitle}
              onChange={(event) => setFormState((prev) => ({ ...prev, missionTitle: event.target.value }))}
            />
          </div>

          <div className="admin-form-grid admin-form-grid-two">
            <div className="form-field">
              <label htmlFor="internship-supervisor">Supervisor</label>
              <select
                id="internship-supervisor"
                value={formState.supervisorId}
                onChange={(event) => setFormState((prev) => ({ ...prev, supervisorId: event.target.value }))}
              >
                <option value="">Select supervisor</option>
                {supervisors.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>{supervisor.fullName}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="internship-co-supervisor">Co-supervisor (optional)</label>
              <select
                id="internship-co-supervisor"
                value={formState.coSupervisorId}
                onChange={(event) => setFormState((prev) => ({ ...prev, coSupervisorId: event.target.value }))}
              >
                <option value="">None</option>
                {supervisors.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>{supervisor.fullName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="admin-form-grid admin-form-grid-three">
            <div className="form-field">
              <label htmlFor="internship-department">Department</label>
              <select
                id="internship-department"
                value={formState.department}
                onChange={(event) => setFormState((prev) => ({ ...prev, department: event.target.value }))}
              >
                <option value="">Not assigned</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>{department.name}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="internship-type">Type</label>
              <select
                id="internship-type"
                value={formState.type}
                onChange={(event) => setFormState((prev) => ({ ...prev, type: event.target.value }))}
              >
                <option value="">Not assigned</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>{type.name}</option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="internship-status">Status</label>
              <select
                id="internship-status"
                value={formState.status}
                onChange={(event) => setFormState((prev) => ({ ...prev, status: event.target.value }))}
              >
                <option value="template">template</option>
                <option value="active">active</option>
                <option value="completed">completed</option>
                <option value="cancelled">cancelled</option>
              </select>
            </div>
          </div>

          <div className="admin-form-grid admin-form-grid-two">
            <div className="form-field">
              <label htmlFor="internship-start-date">Start Date</label>
              <input
                id="internship-start-date"
                type="date"
                value={formState.startDate}
                onChange={(event) => setFormState((prev) => ({ ...prev, startDate: event.target.value }))}
              />
            </div>

            <div className="form-field">
              <label htmlFor="internship-end-date">End Date</label>
              <input
                id="internship-end-date"
                type="date"
                value={formState.endDate}
                onChange={(event) => setFormState((prev) => ({ ...prev, endDate: event.target.value }))}
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="internship-objectives">Objectives</label>
            <textarea
              id="internship-objectives"
              className="admin-textarea"
              value={formState.objectives}
              onChange={(event) => setFormState((prev) => ({ ...prev, objectives: event.target.value }))}
            />
          </div>

          {formError && <p className="form-error">{formError}</p>}

          <div className="modal-actions">
            <DashboardButton variant="secondary" size="md" onClick={() => setFormModalOpen(false)} type="button">
              Cancel
            </DashboardButton>
            <DashboardButton variant="primary" size="md" loading={formSubmitting} type="submit">
              {editingInternshipId ? 'Save Changes' : 'Create Internship'}
            </DashboardButton>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={detailsModalOpen}
        onClose={() => setDetailsModalOpen(false)}
        title={selectedInternship ? `Internship: ${selectedInternship.missionTitle}` : 'Internship Details'}
      >
        {!selectedInternship ? (
          <div className="dash-empty">
            <h3 className="dash-empty-title">No details available</h3>
          </div>
        ) : (
          <div>
            <div className="admin-tab-row">
              <button
                className={`admin-tab-button ${detailsTab === 'details' ? 'is-active' : ''}`}
                onClick={() => setDetailsTab('details')}
                type="button"
              >
                Details
              </button>
              <button
                className={`admin-tab-button ${detailsTab === 'history' ? 'is-active' : ''}`}
                onClick={() => setDetailsTab('history')}
                type="button"
              >
                History
              </button>
            </div>

            {detailsTab === 'details' ? (
              <div className="admin-modal-details-grid">
                <div>
                  <h3>Mission</h3>
                  <p>{selectedInternship.missionTitle}</p>
                </div>
                <div>
                  <h3>Status</h3>
                  <p>{selectedInternship.status}</p>
                </div>
                <div>
                  <h3>Intern</h3>
                  <p>{selectedInternship.internName ?? '-'}</p>
                </div>
                <div>
                  <h3>Supervisor</h3>
                  <p>{selectedInternship.supervisorName ?? '-'}</p>
                </div>
                <div>
                  <h3>Department</h3>
                  <p>{selectedInternship.department ?? '-'}</p>
                </div>
                <div>
                  <h3>Type</h3>
                  <p>{selectedInternship.type ?? '-'}</p>
                </div>
                <div>
                  <h3>Start Date</h3>
                  <p>{selectedInternship.startDate ? new Date(selectedInternship.startDate).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <h3>End Date</h3>
                  <p>{selectedInternship.endDate ? new Date(selectedInternship.endDate).toLocaleDateString() : '-'}</p>
                </div>
                <div className="admin-modal-span-all">
                  <h3>Objectives</h3>
                  <p>{selectedInternship.objectives || '-'}</p>
                </div>
              </div>
            ) : historyLoading ? (
              <Skeleton height="220px" />
            ) : historyError ? (
              <ErrorState message={historyError} onRetry={() => void loadHistory(selectedInternship.id)} />
            ) : historyItems.length === 0 ? (
              <div className="dash-empty">
                <h3 className="dash-empty-title">No history records</h3>
                <p className="dash-empty-description">No change log entries are available for this internship.</p>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="dash-table super-admin-table">
                  <thead>
                    <tr>
                      <th>Field</th>
                      <th>Old Value</th>
                      <th>New Value</th>
                      <th>Changed By</th>
                      <th>Changed At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyItems.map((item) => (
                      <tr key={item.id}>
                        <td>{item.field}</td>
                        <td>{item.oldValue || '-'}</td>
                        <td>{item.newValue || '-'}</td>
                        <td>{item.changedBy}</td>
                        <td>{item.changedAt ? new Date(item.changedAt).toLocaleString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </section>
  )
}

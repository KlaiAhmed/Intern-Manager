import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { Input } from '../../../../components/ui/Input'
import { Edit, Eye, Search } from '../../components/IconComponents'
import { ErrorState } from '../../components/ErrorState'
import { Modal } from '../../components/Modal'
import { Skeleton } from '../../components/Skeleton'
import { DashboardButton } from '../../components/DashboardButton'
import { useDashboardApi } from '../../hooks/useDashboardApi'
import { apiBaseUrl } from '../../../../lib/apiClient'
import type { InternApi, InternRecord, PagedResponse } from '../types/operations'
import { toDashboardErrorMessage } from '../utils/errorMessage'
import { mapInternApi } from '../utils/operations'
import styles from './OperationalInternsSection.module.css'

export function OperationalInternsSection() {
  const { t } = useI18n()
  const api = useDashboardApi()
  const pageSize = 10
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [interns, setInterns] = useState<InternRecord[]>([])
  const [searchFilter, setSearchFilter] = useState('')
  const [page, setPage] = useState(1)

  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [selectedIntern, setSelectedIntern] = useState<InternRecord | null>(null)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [detailsInternId, setDetailsInternId] = useState<string | null>(null)

  const loadInterns = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const payload = await api.get<PagedResponse<InternApi>>('/api/interns?limit=500')
      const mappedInterns = (payload.data ?? [])
        .map(mapInternApi)
        .filter((intern): intern is InternRecord => intern !== null)

      setInterns(mappedInterns)
      setPage(1)
    } catch (requestError) {
      setError(toDashboardErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [api])

  const loadDepartments = useCallback(async () => {
    try {
      const result = await api.get<unknown>('/api/admin/settings/departments')
      const raw: { id?: string; name?: string }[] = Array.isArray(result)
        ? result
        : Array.isArray((result as Record<string, unknown>).data)
          ? (result as Record<string, unknown>).data as { id?: string; name?: string }[]
          : []
      setDepartments(raw.filter((d): d is { id: string; name: string } => typeof d.id === 'string' && typeof d.name === 'string'))
    } catch {
      setDepartments([])
    }
  }, [api])

  useEffect(() => {
    void loadInterns()
    void loadDepartments()
  }, [loadInterns, loadDepartments])

  const roles = [
    { value: 'admin', label: t('role.admin') },
    { value: 'supervisor', label: t('role.supervisor') },
    { value: 'intern', label: t('role.intern') },
    { value: 'manager', label: t('role.manager') },
  ]

  const statusOptions = [
    { value: 'active', label: t('dashboard.admin.statusActive') },
    { value: 'archived', label: t('dashboard.admin.statusArchived') },
  ]

  const filteredInterns = useMemo(() => {
    const normalizedSearch = searchFilter.trim().toLowerCase()

    if (!normalizedSearch) {
      return interns
    }

    return interns.filter((intern) => {
      return (
        intern.fullName.toLowerCase().includes(normalizedSearch)
        || intern.email.toLowerCase().includes(normalizedSearch)
        || intern.accountStatus.toLowerCase().includes(normalizedSearch)
        || intern.verificationStatus.toLowerCase().includes(normalizedSearch)
      )
    })
  }, [interns, searchFilter])

  const pagedInterns = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredInterns.slice(start, start + pageSize)
  }, [filteredInterns, page])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredInterns.length / pageSize))
  }, [filteredInterns.length])

  const openInternDetails = async (internId: string) => {
    setDetailsInternId(internId)
    setDetailsLoading(true)
    setDetailsError(null)
    setDetailsModalOpen(true)

    try {
      const payload = await api.get<InternApi>(`/api/interns/${internId}`)
      const mappedIntern = mapInternApi(payload)

      if (!mappedIntern) {
        throw new Error('Unable to read intern details.')
      }

      setSelectedIntern(mappedIntern)
    } catch (requestError) {
      setDetailsError(toDashboardErrorMessage(requestError))
      setSelectedIntern(null)
    } finally {
      setDetailsLoading(false)
    }
  }

  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])

  const [editingIntern, setEditingIntern] = useState<InternRecord | null>(null)
  const [editFormData, setEditFormData] = useState({ name: '', email: '', role: 'intern', status: 'active' as 'active' | 'archived', department: '' })
  const [editFormErrors, setEditFormErrors] = useState<Record<string, string>>({})
  const [isEditSubmitting, setIsEditSubmitting] = useState(false)

  const handleEdit = (intern: InternRecord) => {
    setEditingIntern(intern)
    setEditFormData({
      name: intern.fullName,
      email: intern.email,
      role: 'intern',
      status: intern.accountStatus === 'archived' ? 'archived' : 'active',
      department: '',
    })
    setEditFormErrors({})
  }

  const closeEditModal = () => {
    if (isEditSubmitting) return
    setEditingIntern(null)
    setEditFormErrors({})
  }

  const handleEditSubmit = async () => {
    if (!editingIntern || isEditSubmitting) return

    const errors: Record<string, string> = {}
    if (!editFormData.name.trim()) errors.name = 'Name is required'
    if (!editFormData.email.trim()) errors.email = 'Email is required'
    if (!editFormData.email.includes('@')) errors.email = 'Invalid email format'
    setEditFormErrors(errors)
    if (Object.keys(errors).length > 0) return

    setIsEditSubmitting(true)

    try {
      const payload: Record<string, string> = {}
      payload.name = editFormData.name.trim()
      payload.email = editFormData.email.trim()
      payload.role = editFormData.role
      payload.status = editFormData.status
      if (editFormData.department) {
        payload.department = editFormData.department
      }
      await api.patch(`/api/users/${editingIntern.id}`, payload)
      setEditingIntern(null)
      setEditFormErrors({})
      void loadInterns()
    } catch (err) {
      setEditFormErrors({ submit: toDashboardErrorMessage(err) })
    } finally {
      setIsEditSubmitting(false)
    }
  }

  return (
    <section className={`${styles.root} super-admin-section admin-view-section`} id="section-interns">
      <header className="section-header-row">
        <div className="section-header-text">
          <h2 className="section-title">{t('dashboard.operational.interns.title')}</h2>
          <p className="section-subtitle">{t('dashboard.operational.interns.subtitle')}</p>
        </div>
      </header>

      <Input
        leftIcon={<Search />}
        placeholder={t('dashboard.operational.interns.searchPlaceholder')}
        value={searchFilter}
        onChange={(event) => setSearchFilter(event.target.value)}
        className="search-input-component"
      />

      {loading ? (
        <div className="skeleton-block">
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadInterns()} />
      ) : filteredInterns.length === 0 ? (
        <div className="dash-empty">
          <h3 className="dash-empty-title">{t('dashboard.operational.interns.empty')}</h3>
          <p className="dash-empty-description">{t('dashboard.operational.interns.emptyDesc')}</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="dash-table super-admin-table">
              <thead>
                <tr>
                  <th>{t('dashboard.operational.interns.table.name')}</th>
                  <th>{t('dashboard.operational.interns.table.email')}</th>
                  <th>{t('dashboard.operational.interns.table.accountStatus')}</th>
                  <th>{t('dashboard.operational.interns.table.verificationStatus')}</th>
                  <th>{t('dashboard.operational.interns.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {pagedInterns.map((intern) => (
                  <tr key={intern.id}>
                    <td>{intern.fullName}</td>
                    <td>{intern.email}</td>
                    <td>{intern.accountStatus}</td>
                    <td>{intern.verificationStatus}</td>
                    <td>
                      <div className="table-row-actions">
                        <button
                          type="button"
                          className="action-btn"
                          onClick={() => void openInternDetails(intern.id)}
                          aria-label="View"
                          title="View"
                        >
                          <Eye />
                        </button>
                        <button
                          className="action-btn action-btn-edit"
                          onClick={() => handleEdit(intern)}
                          aria-label={t('dashboard.table.edit')}
                          title={t('dashboard.table.edit')}
                        >
                          <Edit />
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
              <span className="pagination-info">{t('dashboard.table.page')} {page} {t('dashboard.table.of')} {totalPages}</span>
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
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false)
          setDetailsInternId(null)
        }}
        title={t('dashboard.operational.interns.modalTitle')}
      >
        {detailsLoading ? (
          <Skeleton height="240px" />
        ) : detailsError ? (
          <ErrorState
            message={detailsError}
            onRetry={() => {
              if (detailsInternId) {
                void openInternDetails(detailsInternId)
              }
            }}
          />
        ) : selectedIntern ? (
          <div className="admin-modal-details-grid">
            <div>
              <h3>{t('dashboard.operational.interns.detail.name')}</h3>
              <p>{selectedIntern.fullName}</p>
            </div>
            <div>
              <h3>{t('dashboard.operational.interns.detail.email')}</h3>
              <p>{selectedIntern.email}</p>
            </div>
            <div>
              <h3>{t('dashboard.operational.interns.detail.accountStatus')}</h3>
              <p>{selectedIntern.accountStatus}</p>
            </div>
            <div>
              <h3>{t('dashboard.operational.interns.detail.verificationStatus')}</h3>
              <p>{selectedIntern.verificationStatus}</p>
            </div>
            <div>
              <h3>{t('dashboard.operational.interns.detail.startDate')}</h3>
              <p>{selectedIntern.startDate ? new Date(selectedIntern.startDate).toLocaleDateString() : '-'}</p>
            </div>
            <div>
              <h3>{t('dashboard.operational.interns.detail.endDate')}</h3>
              <p>{selectedIntern.endDate ? new Date(selectedIntern.endDate).toLocaleDateString() : '-'}</p>
            </div>
            <div className="admin-modal-span-all">
              <h3>{t('dashboard.operational.interns.detail.cv')}</h3>
              {selectedIntern.cvFileUrl ? (
                <button
                  type="button"
                  className="admin-link-button"
                  onClick={() => {
                    const cvUrl = `${apiBaseUrl}/api/interns/${selectedIntern.id}/cv`
                    window.open(cvUrl, '_blank', 'noopener,noreferrer')
                  }}
                >
                  Open CV file
                </button>
              ) : (
                <p>{t('dashboard.operational.interns.noCv')}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="dash-empty">
            <h3 className="dash-empty-title">{t('dashboard.operational.interns.noDetails')}</h3>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={editingIntern !== null}
        onClose={closeEditModal}
        title="Edit Intern"
      >
        <form
          className="modal-form"
          onSubmit={(e) => {
            e.preventDefault()
            void handleEditSubmit()
          }}
        >
          <div className="form-field">
            <label htmlFor="intern-name">{t('dashboard.form.name')}</label>
            <input
              id="intern-name"
              type="text"
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              className={editFormErrors.name ? 'input-error' : ''}
            />
            {editFormErrors.name && <span className="field-error">{editFormErrors.name}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="intern-email">{t('dashboard.form.email')}</label>
            <input
              id="intern-email"
              type="email"
              value={editFormData.email}
              onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
              className={editFormErrors.email ? 'input-error' : ''}
            />
            {editFormErrors.email && <span className="field-error">{editFormErrors.email}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="intern-department">{t('dashboard.form.department')}</label>
            <select
              id="intern-department"
              value={editFormData.department}
              onChange={(e) => setEditFormData({ ...editFormData, department: e.target.value })}
            >
              <option value="">{t('dashboard.admin.allDepartments')}</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="intern-role">{t('dashboard.form.role')}</label>
              <select
                id="intern-role"
                value={editFormData.role}
                onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
              >
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="intern-status">{t('dashboard.form.status')}</label>
              <select
                id="intern-status"
                value={editFormData.status}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as 'active' | 'archived' })}
              >
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {editFormErrors.submit && <p className="form-error">{editFormErrors.submit}</p>}

          <div className="modal-actions">
            <button
              type="button"
              className="dash-btn dash-btn-secondary dash-btn-md"
              onClick={closeEditModal}
              disabled={isEditSubmitting}
            >
              {t('dashboard.form.cancel')}
            </button>
            <button
              type="submit"
              className="dash-btn dash-btn-primary dash-btn-md"
              disabled={isEditSubmitting}
            >
              {isEditSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  )
}

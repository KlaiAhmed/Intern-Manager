import { useEffect, useState } from 'react'
import { useI18n } from '../../../locales/I18nContext'
import { isDashboardApiError } from '../hooks/useDashboardApi'
import { useUserManagement, type User, type UserDeletionBlockers } from '../hooks/useUserManagement'
import { Skeleton } from './Skeleton'
import { ErrorState } from './ErrorState'
import { Modal } from './Modal'
import { Plus, Edit, Archive, Search, Trash2 } from './IconComponents'
import { Input } from '../../../components/ui/Input'
import { getConfirmPasswordErrorKey, getPasswordPolicyErrorKey } from '../../../utils/passwordValidation'

export function UserManagementSection() {
  const { t } = useI18n()
  const {
    users,
    departments,
    loading,
    error,
    page,
    totalPages,
    filters,
    setFilters,
    goToPage,
    refresh,
    createUser,
    updateUser,
    archiveUser,
    deleteUser,
  } = useUserManagement()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'admin',
    status: 'active' as 'active' | 'archived',
    department: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<User | null>(null)
  const [archiveError, setArchiveError] = useState<string | null>(null)
  const [isArchiving, setIsArchiving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleteBlockers, setDeleteBlockers] = useState<UserDeletionBlockers | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

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

  useEffect(() => {
    if (!successMessage) return
    const timeoutId = window.setTimeout(() => setSuccessMessage(null), 3000)
    return () => window.clearTimeout(timeoutId)
  }, [successMessage])

  const getRoleBadgeClass = (role: string) => {
    const classes: Record<string, string> = {
      admin: 'dash-badge-error',
      supervisor: 'dash-badge-active',
      intern: 'dash-badge-pending',
      manager: 'dash-badge-completed',
    }
    return classes[role] || 'dash-badge-archived'
  }

  const syncPasswordErrors = (nextPassword: string, nextConfirmPassword: string) => {
    setFormErrors((previous) => {
      const nextErrors = { ...previous }
      const passwordErrorKey = getPasswordPolicyErrorKey(nextPassword)
      const confirmPasswordErrorKey = getConfirmPasswordErrorKey(nextPassword, nextConfirmPassword)

      if (passwordErrorKey) {
        nextErrors.password = t(passwordErrorKey)
      } else {
        delete nextErrors.password
      }

      if (confirmPasswordErrorKey) {
        nextErrors.confirmPassword = t(confirmPasswordErrorKey)
      } else {
        delete nextErrors.confirmPassword
      }

      delete nextErrors.submit

      return nextErrors
    })
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.name.trim()) errors.name = t('auth.validation.firstNameRequired')
    if (!formData.email.trim()) errors.email = t('auth.validation.emailRequired')
    if (!formData.email.includes('@')) errors.email = t('auth.validation.emailInvalid')
    // Department is now optional - no validation needed

    // Password validation for new users
    if (!editingUser) {
      const passwordErrorKey = getPasswordPolicyErrorKey(formData.password)
      if (passwordErrorKey) {
        errors.password = t(passwordErrorKey)
      }

      const confirmPasswordErrorKey = getConfirmPasswordErrorKey(formData.password, formData.confirmPassword)
      if (confirmPasswordErrorKey) {
        errors.confirmPassword = t(confirmPasswordErrorKey)
      }
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return
    setIsSubmitting(true)
    try {
      if (editingUser) {
        await updateUser(editingUser.id, formData)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars -- confirmPassword is for validation only
const { confirmPassword, ...userData } = formData
        await createUser(userData)
      }
      setIsCreateModalOpen(false)
      setEditingUser(null)
      setFormData({ name: '', email: '', password: '', confirmPassword: '', role: 'admin', status: 'active', department: '' })
    } catch {
      setFormErrors({ submit: 'An error occurred. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (user: User) => {
    const departmentMatch = departments.find(
      (department) =>
        department.name.trim().toLowerCase() === user.department.trim().toLowerCase()
    )

    setEditingUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      confirmPassword: '',
      role: user.role,
      status: user.status,
      department: departmentMatch?.id ?? '',
    })
    setIsCreateModalOpen(true)
  }

  const openArchiveModal = (user: User) => {
    setArchiveTarget(user)
    setArchiveError(null)
  }

  const closeArchiveModal = () => {
    if (isArchiving) return
    setArchiveTarget(null)
    setArchiveError(null)
  }

  const handleArchiveConfirm = async () => {
    if (!archiveTarget || isArchiving) return

    setIsArchiving(true)
    setArchiveError(null)

    try {
      await archiveUser(archiveTarget.id)
      setArchiveTarget(null)
      setSuccessMessage(t('dashboard.table.archiveSuccess'))
    } catch {
      setArchiveError(t('dashboard.table.archiveFailed'))
    } finally {
      setIsArchiving(false)
    }
  }

  const openDeleteModal = (user: User) => {
    setDeleteTarget(user)
    setDeleteError(null)
    setDeleteBlockers(null)
  }

  const closeDeleteModal = () => {
    if (isDeleting) return
    setDeleteTarget(null)
    setDeleteError(null)
    setDeleteBlockers(null)
  }

  const handleDelete = async () => {
    if (!deleteTarget || isDeleting) return

    setIsDeleting(true)
    setDeleteError(null)

    try {
      await deleteUser(deleteTarget.id)
      setDeleteTarget(null)
      setDeleteBlockers(null)
      setSuccessMessage(t('dashboard.table.deleteSuccess'))
    } catch (err) {
      if (isDashboardApiError(err) && err.code) {
        const codeToKey: Record<string, string> = {
          USER_NOT_FOUND: 'dashboard.userDeletion.notFound',
          USER_NOT_ARCHIVED: 'dashboard.userDeletion.notArchived',
          USER_DELETE_FORBIDDEN: 'dashboard.userDeletion.forbidden',
          USER_DELETE_BLOCKED: 'dashboard.userDeletion.blocked',
        }
        const key = codeToKey[err.code] ?? 'dashboard.table.deleteFailed'
        setDeleteError(t(key))
        setDeleteBlockers((err.blockers ?? null) as UserDeletionBlockers | null)
      } else {
        setDeleteError(t('dashboard.table.deleteFailed'))
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const isDeleteModalOpen = Boolean(deleteTarget)
  const isArchiveModalOpen = Boolean(archiveTarget)

  const renderDeleteBlockers = () => {
    if (!deleteBlockers) return null

    const blockerEntries: Array<{ key: keyof UserDeletionBlockers; label: string }> = [
      { key: 'missionsAsSupervisor', label: t('dashboard.userDeletion.blockers.missionsAsSupervisor') },
      { key: 'deliverablesAsSupervisor', label: t('dashboard.userDeletion.blockers.deliverablesAsSupervisor') },
      { key: 'evaluations', label: t('dashboard.userDeletion.blockers.evaluations') },
      { key: 'meetings', label: t('dashboard.userDeletion.blockers.meetings') },
      { key: 'journalComments', label: t('dashboard.userDeletion.blockers.journalComments') },
      { key: 'journalEvaluationLinks', label: t('dashboard.userDeletion.blockers.journalEvaluationLinks') },
    ]

    const activeEntries = blockerEntries.filter(({ key }) => (deleteBlockers[key] ?? 0) > 0)
    if (activeEntries.length === 0) return null

    return (
      <div className="form-field">
        <label>{t('dashboard.userDeletion.blockersTitle')}</label>
        {activeEntries.map(({ key, label }) => (
          <div key={String(key)} className="field-helper">
            {t('dashboard.userDeletion.blockerCount', { label, count: deleteBlockers[key] ?? 0 })}
          </div>
        ))}
      </div>
    )
  }

  return (
    <section className="super-admin-section user-management-section">
      {successMessage && (
        <div className="supervisor-success-toast" role="status" aria-live="polite">
          {successMessage}
        </div>
      )}
      {/* Header with title and create button */}
      <header className="section-header-row">
        <div className="section-header-text">
          <h2 className="section-title">{t('dashboard.superAdmin.userManagement')}</h2>
          <p className="section-subtitle">{t('dashboard.superAdmin.userManagementDesc')}</p>
        </div>
        <button
          className="dash-btn dash-btn-primary dash-btn-md"
          onClick={() => {
            setEditingUser(null)
            setFormData({ name: '', email: '', password: '', confirmPassword: '', role: 'admin', status: 'active', department: '' })
            setFormErrors({})
            setIsCreateModalOpen(true)
          }}
        >
          <span className="btn-icon"><Plus /></span>
          <span>{t('dashboard.superAdmin.addUser')}</span>
        </button>
      </header>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="filter-group">
          <select
            className="dash-input dash-select"
            value={filters.role}
            onChange={(e) => setFilters({ role: e.target.value })}
          >
            <option value="">{t('dashboard.admin.allRoles')}</option>
            {roles.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>

          <select
            className="dash-input dash-select"
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value })}
          >
            <option value="">{t('dashboard.admin.allStatuses')}</option>
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>

          <select
            className="dash-input dash-select"
            value={filters.department}
            onChange={(e) => setFilters({ department: e.target.value })}
          >
            <option value="">{t('dashboard.admin.allDepartments')}</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>

        <Input
              leftIcon={<Search />}
              placeholder={t('dashboard.table.search')}
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
              className="search-input-component"
            /></div>

      {/* Table */}
      {loading ? (
        <div className="skeleton-block">
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : users.length === 0 ? (
        <div className="dash-empty">
          <p>{t('dashboard.table.noResults')}</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="dash-table super-admin-table">
              <thead>
                <tr>
                  <th>{t('dashboard.table.name')}</th>
                  <th>{t('dashboard.table.email')}</th>
                  <th>{t('dashboard.table.role')}</th>
                  <th>{t('dashboard.table.status')}</th>
                  <th>{t('dashboard.table.department')}</th>
                  <th>{t('dashboard.table.created')}</th>
                  <th>{t('dashboard.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="user-name-cell">
                      <div className="user-avatar">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <span>{user.name}</span>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`dash-badge ${getRoleBadgeClass(user.role)}`}>
                        {roles.find((r) => r.value === user.role)?.label || user.role}
                      </span>
                    </td>
                    <td>
                      <span className={`dash-status-badge dash-status-badge-${user.status}`}>
                        {statusOptions.find((s) => s.value === user.status)?.label || user.status}
                      </span>
                    </td>
                    <td>{user.department || '-'}</td>
                    <td>{new Date(user.created).toLocaleDateString()}</td>
                    <td>
                      <div className="table-row-actions">
                        <button
                          className="action-btn action-btn-edit"
                          onClick={() => handleEdit(user)}
                          aria-label={t('dashboard.table.edit')}
                          title={t('dashboard.table.edit')}
                        >
                          <Edit />
                        </button>
                        <span title={user.status === 'archived' ? t('dashboard.table.archiveDisabled') : t('dashboard.table.archive')}>
                          <button
                            className="action-btn action-btn-archive"
                            onClick={() => {
                              if (user.status === 'archived') return
                              openArchiveModal(user)
                            }}
                            aria-label={t('dashboard.table.archive')}
                            disabled={user.status === 'archived'}
                          >
                            <Archive />
                          </button>
                        </span>
                        <span
                          title={
                            user.status === 'archived'
                              ? t('dashboard.table.delete')
                              : t('dashboard.table.archiveRequired')
                          }
                        >
                          <button
                            className="action-btn action-btn-delete"
                            onClick={() => {
                              if (user.status !== 'archived') return
                              openDeleteModal(user)
                            }}
                            aria-label={t('dashboard.table.delete')}
                            disabled={user.status !== 'archived'}
                          >
                            <Trash2 />
                          </button>
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="table-pagination">
              <button
                className="dash-btn dash-btn-secondary dash-btn-sm"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
              >
                ← {t('dashboard.table.previous')}
              </button>
              <span className="pagination-info">
                {t('dashboard.table.page')} {page} {t('dashboard.table.of')} {totalPages}
              </span>
              <button
                className="dash-btn dash-btn-secondary dash-btn-sm"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
              >
                {t('dashboard.table.next')} →
              </button>
            </div>
          )}
        </>
      )}

      {/* Archive Confirmation Modal */}
      <Modal
        isOpen={isArchiveModalOpen}
        onClose={closeArchiveModal}
        title={t('dashboard.table.archive')}
      >
        <div className="modal-form">
          <p>{t('dashboard.table.archiveConfirm')}</p>
          <div className="form-field">
            <label>{t('dashboard.table.name')}</label>
            <div>{archiveTarget?.name}</div>
          </div>
          <div className="form-field">
            <label>{t('dashboard.table.email')}</label>
            <div>{archiveTarget?.email}</div>
          </div>
          {archiveError && <p className="form-error">{archiveError}</p>}
          <div className="modal-actions">
            <button
              type="button"
              className="dash-btn dash-btn-secondary dash-btn-md"
              onClick={closeArchiveModal}
              disabled={isArchiving}
            >
              {t('dashboard.form.cancel')}
            </button>
            <button
              type="button"
              className="dash-btn dash-btn-primary dash-btn-md"
              onClick={() => void handleArchiveConfirm()}
              disabled={isArchiving}
            >
              {t('dashboard.table.archive')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        title={t('dashboard.table.delete')}
      >
        <div className="modal-form">
          <p>{t('dashboard.table.deleteConfirm')}</p>
          <p className="field-helper">{t('dashboard.table.deletePermanentWarning')}</p>
          <p className="field-helper">{t('dashboard.table.deleteCleanupHint')}</p>
          <div className="form-field">
            <label>{t('dashboard.table.name')}</label>
            <div>{deleteTarget?.name}</div>
          </div>
          <div className="form-field">
            <label>{t('dashboard.table.email')}</label>
            <div>{deleteTarget?.email}</div>
          </div>
          {renderDeleteBlockers()}
          {deleteError && <p className="form-error">{deleteError}</p>}
          <div className="modal-actions">
            <button
              type="button"
              className="dash-btn dash-btn-secondary dash-btn-md"
              onClick={closeDeleteModal}
              disabled={isDeleting}
            >
              {t('dashboard.form.cancel')}
            </button>
            <button
              type="button"
              className="dash-btn dash-btn-primary dash-btn-md"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {t('dashboard.table.delete')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={editingUser ? t('dashboard.superAdmin.editUser') : t('dashboard.superAdmin.addUser')}
      >
        <form
          className="modal-form"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
        >
          <div className="form-field">
            <label htmlFor="user-name">{t('dashboard.form.name')}</label>
            <input
              id="user-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className={formErrors.name ? 'input-error' : ''}
            />
            {formErrors.name && <span className="field-error">{formErrors.name}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="user-email">{t('dashboard.form.email')}</label>
            <input
              id="user-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={formErrors.email ? 'input-error' : ''}
            />
          {formErrors.email && <span className="field-error">{formErrors.email}</span>}
        </div>


        {!editingUser && (
          <>
            <div className="form-field">
              <label htmlFor="user-password">Password</label>
              <input
                id="user-password"
                type="password"
                value={formData.password}
                onChange={(e) => {
                  const nextPassword = e.target.value
                  const nextFormData = { ...formData, password: nextPassword }
                  setFormData(nextFormData)
                  syncPasswordErrors(nextPassword, nextFormData.confirmPassword)
                }}
                className={formErrors.password ? 'input-error' : ''}
              />
              {formErrors.password && <span className="field-error">{formErrors.password}</span>}
            </div>

            <div className="form-field">
              <label htmlFor="user-confirm-password">Confirm Password</label>
              <input
                id="user-confirm-password"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => {
                  const nextConfirmPassword = e.target.value
                  const nextFormData = { ...formData, confirmPassword: nextConfirmPassword }
                  setFormData(nextFormData)
                  syncPasswordErrors(nextFormData.password, nextConfirmPassword)
                }}
                className={formErrors.confirmPassword ? 'input-error' : ''}
              />
              {formErrors.confirmPassword && <span className="field-error">{formErrors.confirmPassword}</span>}
            </div>
          </>
        )}

          <div className="form-field">
            <label htmlFor="user-department">{t('dashboard.form.department')}</label>
            <select
              id="user-department"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              className={formErrors.department ? 'input-error' : ''}
            >
              <option value="">{t('dashboard.admin.allDepartments')}</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
            {formErrors.department && <span className="field-error">{formErrors.department}</span>}
          </div>

          <div className="form-row">
            <div className="form-field">
              <label htmlFor="user-role">{t('dashboard.form.role')}</label>
              <select
                id="user-role"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="user-status">{t('dashboard.form.status')}</label>
              <select
                id="user-status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'archived' })}
              >
                {statusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {formErrors.submit && <p className="form-error">{formErrors.submit}</p>}

          <div className="modal-actions">
            <button
              type="button"
              className="dash-btn dash-btn-secondary dash-btn-md"
              onClick={() => setIsCreateModalOpen(false)}
            >
              {t('dashboard.form.cancel')}
            </button>
            <button
              type="submit"
              className="dash-btn dash-btn-primary dash-btn-md"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Saving...'
                : editingUser
                  ? 'Save Changes'
                  : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  )
}


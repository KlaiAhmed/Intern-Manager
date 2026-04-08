import { useState } from 'react'
import { useI18n } from '../../../locales/I18nContext'
import { useUserManagement, type User } from '../hooks/useUserManagement'
import { Skeleton } from './Skeleton'
import { ErrorState } from './ErrorState'
import { Modal } from './Modal'
import { Plus, Edit, Archive, Search, X } from './IconComponents'

export function UserManagementSection() {
  const { t } = useI18n()
  const {
    users,
    departments,
    statuses,
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

  const roles = [
    { value: 'admin', label: t('role.admin') },
    { value: 'supervisor', label: t('role.supervisor') },
    { value: 'manager', label: t('role.manager') },
  ]

  const statusOptions = statuses.map((status) => ({
    value: status.name.toLowerCase(),
    label: status.name,
  }))

  const getRoleBadgeClass = (role: string) => {
    const classes: Record<string, string> = {
      admin: 'dash-badge-error',
      supervisor: 'dash-badge-active',
      intern: 'dash-badge-pending',
      manager: 'dash-badge-completed',
    }
    return classes[role] || 'dash-badge-archived'
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.name.trim()) errors.name = t('dashboard.form.required')
    if (!formData.email.trim()) errors.email = t('dashboard.form.required')
    if (!formData.email.includes('@')) errors.email = t('auth.validation.emailInvalid')
    if (!editingUser && !formData.department.trim()) errors.department = t('dashboard.form.required')

    // Password validation for new users
    if (!editingUser) {
      if (!formData.password.trim()) {
        errors.password = t('dashboard.form.required')
      } else if (formData.password.length < 8) {
        errors.password = 'Password must be at least 8 characters'
      }

      if (!formData.confirmPassword.trim()) {
        errors.confirmPassword = t('dashboard.form.required')
      } else if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match'
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

  const handleArchive = async (userId: string) => {
    if (confirm('Are you sure you want to archive this user?')) {
      await archiveUser(userId)
    }
  }

  return (
    <section className="super-admin-section user-management-section">
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

        <div className="search-box">
          <span className="search-icon"><Search /></span>
          <input
            type="text"
            className="dash-input search-input"
            placeholder={t('dashboard.table.search')}
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
          />
          {filters.search && (
            <button
              className="clear-search"
              onClick={() => setFilters({ search: '' })}
              aria-label="Clear search"
            >
              <X />
            </button>
          )}
        </div>
      </div>

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
                        <button
                          className="action-btn action-btn-archive"
                          onClick={() => handleArchive(user.id)}
                          aria-label={t('dashboard.table.archive')}
                          title={t('dashboard.table.archive')}
                        >
                          <Archive />
                        </button>
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
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
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


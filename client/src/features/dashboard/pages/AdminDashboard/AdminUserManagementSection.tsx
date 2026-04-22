import { useMemo, useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { Input } from '../../../../components/ui/Input'
import { useUserManagement, type User } from '../../hooks/useUserManagement'
import { Skeleton } from '../../components/Skeleton'
import { ErrorState } from '../../components/ErrorState'
import { Modal } from '../../components/Modal'
import { Plus, Edit, Archive, Search } from '../../components/IconComponents'
import { getConfirmPasswordErrorKey, getPasswordPolicyErrorKey } from '../../../../utils/passwordValidation'

const excludedRoles = new Set(['admin', 'superadmin'])

type FormStatus = 'active' | 'archived'

interface UserFormState {
  name: string
  email: string
  password: string
  confirmPassword: string
  role: string
  status: FormStatus
  department: string
}

function createInitialFormData(): UserFormState {
  return {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'supervisor',
    status: 'active',
    department: '',
  }
}

function normalizeRole(value: string): string {
  return value.trim().toLowerCase()
}

export function AdminUserManagementSection() {
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
  } = useUserManagement()

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState<UserFormState>(createInitialFormData)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const roles = [
    { value: 'supervisor', label: t('role.supervisor') },
    { value: 'intern', label: t('role.intern') },
    { value: 'manager', label: t('role.manager') },
  ]

  const statusOptions = [
    { value: 'active', label: t('dashboard.admin.statusActive') },
    { value: 'archived', label: t('dashboard.admin.statusArchived') },
  ]

  const filteredUsers = useMemo(
    () => users.filter((user) => !excludedRoles.has(normalizeRole(user.role))),
    [users],
  )

  const setScopedFilters = (nextFilters: Partial<{ role: string; status: string; department: string; search: string }>) => {
    if (typeof nextFilters.role === 'string' && excludedRoles.has(normalizeRole(nextFilters.role))) {
      setFilters({ ...nextFilters, role: '' })
      return
    }

    setFilters(nextFilters)
  }

  const getRoleBadgeClass = (role: string) => {
    const classes: Record<string, string> = {
      supervisor: 'dash-badge-active',
      intern: 'dash-badge-pending',
      manager: 'dash-badge-completed',
    }

    return classes[normalizeRole(role)] || 'dash-badge-archived'
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
    const nextErrors: Record<string, string> = {}

    if (!formData.name.trim()) nextErrors.name = t('auth.validation.firstNameRequired')
    if (!formData.email.trim()) nextErrors.email = t('auth.validation.emailRequired')
    if (!formData.email.includes('@')) nextErrors.email = t('auth.validation.emailInvalid')

    const normalizedRole = normalizeRole(formData.role)
    if (excludedRoles.has(normalizedRole)) {
      nextErrors.role = t('dashboard.admin.allRoles')
    }

    if (!editingUser) {
      const passwordErrorKey = getPasswordPolicyErrorKey(formData.password)
      if (passwordErrorKey) {
        nextErrors.password = t(passwordErrorKey)
      }

      const confirmPasswordErrorKey = getConfirmPasswordErrorKey(formData.password, formData.confirmPassword)
      if (confirmPasswordErrorKey) {
        nextErrors.confirmPassword = t(confirmPasswordErrorKey)
      }
    }

    setFormErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const resetForm = () => {
    setEditingUser(null)
    setFormData(createInitialFormData())
    setFormErrors({})
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
      resetForm()
    } catch {
      setFormErrors({ submit: 'An error occurred. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (user: User) => {
    const departmentMatch = departments.find(
      (department) => department.name.trim().toLowerCase() === user.department.trim().toLowerCase(),
    )

    const normalizedRole = normalizeRole(user.role)
    const roleValue = roles.some((role) => role.value === normalizedRole) ? normalizedRole : 'supervisor'

    setEditingUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      confirmPassword: '',
      role: roleValue,
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
    <section className="super-admin-section user-management-section" id="section-users">
      <header className="section-header-row">
        <div className="section-header-text">
          <h2 className="section-title">{t('dashboard.superAdmin.userManagement')}</h2>
          <p className="section-subtitle">{t('dashboard.superAdmin.userManagementDesc')}</p>
        </div>
        <button
          className="dash-btn dash-btn-primary dash-btn-md"
          onClick={() => {
            resetForm()
            setIsCreateModalOpen(true)
          }}
        >
          <span className="btn-icon"><Plus /></span>
          <span>{t('dashboard.superAdmin.addUser')}</span>
        </button>
      </header>

      <div className="filter-bar">
        <div className="filter-group">
          <select
            className="dash-input dash-select"
            value={filters.role}
            onChange={(event) => setScopedFilters({ role: event.target.value })}
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
            onChange={(event) => setScopedFilters({ status: event.target.value })}
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
            onChange={(event) => setScopedFilters({ department: event.target.value })}
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
          onChange={(event) => setScopedFilters({ search: event.target.value })}
          className="search-input-component"
        />
      </div>

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
      ) : filteredUsers.length === 0 ? (
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
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="user-name-cell">
                      <div className="user-avatar">{user.name.charAt(0).toUpperCase()}</div>
                      <span>{user.name}</span>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`dash-badge ${getRoleBadgeClass(user.role)}`}>
                        {roles.find((role) => role.value === normalizeRole(user.role))?.label || user.role}
                      </span>
                    </td>
                    <td>
                      <span className={`dash-status-badge dash-status-badge-${user.status}`}>
                        {statusOptions.find((status) => status.value === user.status)?.label || user.status}
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

          {totalPages > 1 && (
            <div className="table-pagination">
              <button
                className="dash-btn dash-btn-secondary dash-btn-sm"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
              >
                {'<- '}
                {t('dashboard.table.previous')}
              </button>
              <span className="pagination-info">
                {t('dashboard.table.page')} {page} {t('dashboard.table.of')} {totalPages}
              </span>
              <button
                className="dash-btn dash-btn-secondary dash-btn-sm"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
              >
                {t('dashboard.table.next')}
                {' ->'}
              </button>
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={editingUser ? t('dashboard.superAdmin.editUser') : t('dashboard.superAdmin.addUser')}
      >
        <form
          className="modal-form"
          onSubmit={(event) => {
            event.preventDefault()
            void handleSubmit()
          }}
        >
          <div className="form-field">
            <label htmlFor="user-name">{t('dashboard.form.name')}</label>
            <input
              id="user-name"
              type="text"
              value={formData.name}
              onChange={(event) => setFormData({ ...formData, name: event.target.value })}
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
              onChange={(event) => setFormData({ ...formData, email: event.target.value })}
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
                  onChange={(event) => {
                    const nextPassword = event.target.value
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
                  onChange={(event) => {
                    const nextConfirmPassword = event.target.value
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
              onChange={(event) => setFormData({ ...formData, department: event.target.value })}
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
                onChange={(event) => setFormData({ ...formData, role: event.target.value })}
                className={formErrors.role ? 'input-error' : ''}
              >
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              {formErrors.role && <span className="field-error">{formErrors.role}</span>}
            </div>

            <div className="form-field">
              <label htmlFor="user-status">{t('dashboard.form.status')}</label>
              <select
                id="user-status"
                value={formData.status}
                onChange={(event) => setFormData({ ...formData, status: event.target.value as FormStatus })}
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
              {isSubmitting ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  )
}

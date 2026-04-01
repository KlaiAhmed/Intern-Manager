import { useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { useRolePreference } from '../../../shared/state/RolePreferenceContext'
import { Card } from '../../../shared/ui/Card'
import { Section } from '../../../shared/ui/Section'
import type { UserRole } from '../../../shared/types/role'
import type { TranslationKey } from '../../../shared/i18n/I18nContext'

const roleContentKeys: Record<UserRole, { title: TranslationKey; description: TranslationKey }> = {
  supervisor: { title: 'roles.supervisorTitle', description: 'roles.supervisorText' },
  intern: { title: 'roles.internTitle', description: 'roles.internText' },
  manager: { title: 'roles.managerTitle', description: 'roles.managerText' },
}

const roleIcons = {
  supervisor: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  intern: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.499 5.221 50.554 50.554 0 00-2.658.813m-15.482 0a50.557 50.557 0 018.445-2.957 2 10.148 10.148 0 00-1.707-1.587A5.98 5.98 0 0012 3.493a59.902 59.902 0 018.647 5.554c.226.255.43.519.605.803v0zm0 0a50.697 50.697 0 011.146-1.666 58.497 58.497 0 013.576-3.442.75.75 0 10-.974-1.139 57.027 57.027 0 00-3.731 3.439A50.75 50.75 0 0112 13.902a50.75 50.75 0 01-7.767-5.403A57.027 57.027 0 00.493 5.06a.75.75 0 00-.974 1.139 58.497 58.497 0 013.576 3.442 50.697 50.697 0 011.146 1.666c.175-.284.379-.548.605-.803" />
    </svg>
  ),
  manager: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
}

export function RoleValueSection() {
  const { t } = useI18n()
  const { activeRole, setActiveRole } = useRolePreference()

  const selectedRoleContent = useMemo(() => roleContentKeys[activeRole], [activeRole])

  const handleRoleChange = (role: UserRole) => {
    if (role === activeRole) return
    setActiveRole(role)
  }

  const roles: UserRole[] = ['supervisor', 'intern', 'manager']

  return (
    <Section id="roles" title={t('roles.title')} subtitle={t('roles.subtitle')}>
      <div
        className="role-selector"
        role="tablist"
        aria-label={t('role.label')}
      >
        {roles.map((role) => (
          <button
            key={role}
            type="button"
            role="tab"
            aria-selected={activeRole === role}
            onClick={() => handleRoleChange(role)}
            className={
              activeRole === role ? 'role-tab is-active' : 'role-tab'
            }
          >
            <span className="role-tab-icon" aria-hidden="true">
              {roleIcons[role]}
            </span>
            <span className="role-tab-label">{t(`role.${role}`)}</span>
          </button>
        ))}
      </div>

      <div className="cards-grid cards-grid-2">
        <Card
          className="role-content-card"
          as="div"
          aria-live="polite"
        >
          <div className="role-content-icon" aria-hidden="true">
            {roleIcons[activeRole]}
          </div>
          <h3>{t(selectedRoleContent.title)}</h3>
          <p>{t(selectedRoleContent.description)}</p>
        </Card>

        <Card
          className="surface-card-emphasis role-preview-card"
          as="div"
        >
          <div className="role-preview-header">
            <span className="role-preview-badge">{t('role.label')}</span>
            <span className="role-preview-current">{t(`role.${activeRole}`)}</span>
          </div>
          <div className="role-preview-body">
            <p className="role-preview-description">
              Experience the platform from the perspective of a {t(`role.${activeRole}`).toLowerCase()}.
              Each role has a tailored dashboard and workflow designed for their specific needs.
            </p>
          </div>
        </Card>
      </div>
    </Section>
  )
}

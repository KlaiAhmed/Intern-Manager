import { useI18n } from '../../../locales/I18nContext'
import { useRolePreference } from '../../../stores/RolePreferenceContext'
import { availableRoles, type UserRole } from '../../../types/role'
import { IconDropdown } from '../IconDropdown'

type RoleSwitcherProps = {
  shouldClose?: boolean
}

export function RoleSwitcher({ shouldClose = false }: RoleSwitcherProps) {
  const { activeRole, setActiveRole } = useRolePreference()
  const { t } = useI18n()
  const activeRoleLabel = t(`role.${activeRole}` as `role.${UserRole}`)
  const options = availableRoles.map((role) => ({
    value: role,
    label: t(`role.${role}` as `role.${UserRole}`),
  }))

  return (
    <IconDropdown
      ariaLabel={`${t('role.label')}: ${activeRoleLabel}`}
      title={`${t('role.label')}: ${activeRoleLabel}`}
      icon={
        <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
          <path d="M16 10.2a2.6 2.6 0 1 0 0-5.2a2.6 2.6 0 0 0 0 5.2ZM8 10.2A2.6 2.6 0 1 0 8 5a2.6 2.6 0 0 0 0 5.2Zm0 2.2c-2.9 0-5.2 1.6-5.2 3.7V19h10.4v-2.9c0-2.1-2.3-3.7-5.2-3.7Zm8 0c-.3 0-.7 0-1 .1c1.3.8 2.2 2.1 2.2 3.6V19h4v-2.9c0-2.1-2.3-3.7-5.2-3.7Z" />
        </svg>
      }
      valueText={activeRoleLabel.slice(0, 2).toUpperCase()}
      options={options}
      selectedValue={activeRole}
      onSelect={(value) => setActiveRole(value as UserRole)}
      shouldClose={shouldClose}
    />
  )
}





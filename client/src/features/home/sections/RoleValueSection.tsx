import { useMemo } from 'react'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { useRolePreference } from '../../../shared/state/RolePreferenceContext'
import { Card } from '../../../shared/ui/Card'
import { RoleSwitcher } from '../../../shared/ui/RoleSwitcher'
import { Section } from '../../../shared/ui/Section'
import type { UserRole } from '../../../shared/types/role'
import type { TranslationKey } from '../../../shared/i18n/I18nContext'

const roleContentKeys: Record<UserRole, { title: TranslationKey; description: TranslationKey }> = {
  admin: { title: 'roles.adminTitle', description: 'roles.adminText' },
  supervisor: { title: 'roles.supervisorTitle', description: 'roles.supervisorText' },
  intern: { title: 'roles.internTitle', description: 'roles.internText' },
  manager: { title: 'roles.managerTitle', description: 'roles.managerText' },
  hr: { title: 'roles.hrTitle', description: 'roles.hrText' },
}

export function RoleValueSection() {
  const { t } = useI18n()
  const { activeRole } = useRolePreference()

  const selectedRoleContent = useMemo(() => roleContentKeys[activeRole], [activeRole])

  return (
    <Section id="roles" title={t('roles.title')} subtitle={t('roles.subtitle')}>
      <div className="roles-selector-row">
        <RoleSwitcher />
      </div>
      <div className="cards-grid cards-grid-2">
        <Card>
          <h3>{t(selectedRoleContent.title)}</h3>
          <p>{t(selectedRoleContent.description)}</p>
        </Card>
        <Card className="surface-card-emphasis" as="div" aria-live="polite">
          <h3>{t('role.label')}</h3>
          <p>{t(`role.${activeRole}` as 'role.admin' | 'role.supervisor' | 'role.intern' | 'role.manager' | 'role.hr')}</p>
        </Card>
      </div>
    </Section>
  )
}

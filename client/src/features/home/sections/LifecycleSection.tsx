import { useI18n } from '../../../shared/i18n/I18nContext'
import { Card } from '../../../shared/ui/Card'
import { Section } from '../../../shared/ui/Section'

const lifecycleItems = [
  { titleKey: 'lifecycle.beforeTitle', textKey: 'lifecycle.beforeText' },
  { titleKey: 'lifecycle.duringTitle', textKey: 'lifecycle.duringText' },
  { titleKey: 'lifecycle.afterTitle', textKey: 'lifecycle.afterText' },
] as const

export function LifecycleSection() {
  const { t } = useI18n()

  return (
    <Section id="lifecycle" title={t('lifecycle.title')}>
      <ol className="cards-grid cards-grid-3 lifecycle-list">
        {lifecycleItems.map((item) => (
          <li key={item.titleKey}>
            <Card as="div">
              <h3>{t(item.titleKey)}</h3>
              <p>{t(item.textKey)}</p>
            </Card>
          </li>
        ))}
      </ol>
    </Section>
  )
}

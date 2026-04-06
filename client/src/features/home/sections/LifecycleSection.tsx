import { useI18n } from '../../../locales/I18nContext'
import { Card } from '../../../components/ui/Card'
import { Section } from '../../../components/ui/Section'

const lifecycleItems = [
  {
    titleKey: 'lifecycle.beforeTitle',
    textKey: 'lifecycle.beforeText',
  },
  {
    titleKey: 'lifecycle.duringTitle',
    textKey: 'lifecycle.duringText',
  },
  {
    titleKey: 'lifecycle.afterTitle',
    textKey: 'lifecycle.afterText',
  },
] as const

export function LifecycleSection() {
  const { t } = useI18n()

  return (
    <Section id="lifecycle" title={t('lifecycle.title')}>
      <ol className="lifecycle-list">
        {lifecycleItems.map((item) => (
          <li key={item.titleKey}>
            <Card as="div" className="lifecycle-card">
              <h3>{t(item.titleKey)}</h3>
              <p>{t(item.textKey)}</p>
            </Card>
          </li>
        ))}
      </ol>
    </Section>
  )
}


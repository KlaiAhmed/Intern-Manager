import { useI18n } from '../../../shared/i18n/I18nContext'
import { Card } from '../../../shared/ui/Card'
import { Section } from '../../../shared/ui/Section'

const benefitItems = [
  { titleKey: 'benefits.item1Title', textKey: 'benefits.item1Text' },
  { titleKey: 'benefits.item2Title', textKey: 'benefits.item2Text' },
  { titleKey: 'benefits.item3Title', textKey: 'benefits.item3Text' },
] as const

export function BenefitsSection() {
  const { t } = useI18n()

  return (
    <Section id="benefits" title={t('benefits.title')} subtitle={t('benefits.subtitle')}>
      <div className="cards-grid cards-grid-3">
        {benefitItems.map((item) => (
          <Card key={item.titleKey}>
            <h3>{t(item.titleKey)}</h3>
            <p>{t(item.textKey)}</p>
          </Card>
        ))}
      </div>
    </Section>
  )
}

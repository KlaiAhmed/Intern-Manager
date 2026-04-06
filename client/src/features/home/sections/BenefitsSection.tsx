import { useI18n } from '../../../locales/I18nContext'
import { Card } from '../../../components/ui/Card'
import { Section } from '../../../components/ui/Section'

const benefitItems = [
  {
    titleKey: 'benefits.item1Title',
    textKey: 'benefits.item1Text',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    titleKey: 'benefits.item2Title',
    textKey: 'benefits.item2Text',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  {
    titleKey: 'benefits.item3Title',
    textKey: 'benefits.item3Text',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 1L5 3.5v5.5c0 5.5 3.5 8.5 7 9.5 3.5-1 7-4 7-9.5V3.5L12 1Z" />
        <path d="M9 9.5l2 2 4-4" />
      </svg>
    ),
  },
] as const

export function BenefitsSection() {
  const { t } = useI18n()

  return (
    <Section id="benefits" title={t('benefits.title')} subtitle={t('benefits.subtitle')}>
      <div className="cards-grid cards-grid-3">
        {benefitItems.map((item) => (
          <Card
            key={item.titleKey}
            className="benefit-card"
          >
            <div
              className="benefit-icon"
              aria-hidden="true"
            >
              {item.icon}
            </div>
            <h3>{t(item.titleKey)}</h3>
            <p>{t(item.textKey)}</p>
          </Card>
        ))}
      </div>
    </Section>
  )
}


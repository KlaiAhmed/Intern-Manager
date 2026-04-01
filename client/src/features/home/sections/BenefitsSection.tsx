import { useI18n } from '../../../shared/i18n/I18nContext'
import { Card } from '../../../shared/ui/Card'
import { Section } from '../../../shared/ui/Section'

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
        <path d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.103 3.714 9.73 9.063 10.646.868.127 1.768.086 2.625-.123a11.99 11.99 0 0010.682-6.672 11.99 11.99 0 009.06-9.06A11.99 11.99 0 009-.286 0 00 00-.286 9 0 007.5zm.124-7.5a11.99 11.99 0 00-6.576 6.576M19.5 12c0-3.879-1.684-7.318-4.324-9.693m-5.82-2.652A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.103 3.714 9.73 9.063 10.646.868.127 1.768.086 2.625-.123a11.99 11.99 0 0010.682-6.672 11.99 11.99 0 009.06-9.06A11.99 11.99 0 009-.286 0 00 00-.286 9 0 007.5z" />
        <path d="M9 12l2 2 4-4" />
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

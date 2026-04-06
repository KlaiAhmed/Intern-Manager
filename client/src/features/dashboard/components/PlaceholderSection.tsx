import { useI18n } from '../../../locales/I18nContext'

interface PlaceholderSectionProps {
  title: string
  subtitle: string
  icon?: string
}

export function PlaceholderSection({ title, subtitle, icon = '🚧' }: PlaceholderSectionProps) {
  const { t } = useI18n()

  return (
    <section className="placeholder-section">
      <header className="section-header-row">
        <div className="section-header-text">
          <h2 className="section-title">{title}</h2>
          <p className="section-subtitle">{subtitle}</p>
        </div>
      </header>
      <div className="placeholder-content">
        <div className="placeholder-icon">{icon}</div>
        <h3 className="placeholder-title">{t('dashboard.placeholder.comingSoon')}</h3>
        <p className="placeholder-description">{t('dashboard.placeholder.checkBack')}</p>
      </div>
    </section>
  )
}


import { memo } from 'react'
import { useI18n } from '../../../locales/I18nContext'

export const BIPanelSection = memo(function BIPanelSection() {
  const { t } = useI18n()

  return (
    <section className="placeholder-section">
      <header className="section-header-row">
        <div className="section-header-text">
          <h2 className="section-title">{t('dashboard.biPanel.title')}</h2>
          <p className="section-subtitle">{t('dashboard.biPanel.subtitle')}</p>
        </div>
      </header>
      <div className="placeholder-content">
        <div className="placeholder-icon">📊</div>
        <h3 className="placeholder-title">{t('dashboard.placeholder.comingSoon')}</h3>
        <p className="placeholder-description">{t('dashboard.placeholder.checkBack')}</p>
      </div>
    </section>
  )
})

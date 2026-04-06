import { useI18n } from '../../../locales/I18nContext'

export function Footer() {
  const { t } = useI18n()

  return (
    <footer className="site-footer">
      <div className="container footer-content">
        <p>{t('footer.tagline')}</p>
        <p>
          Â© {new Date().getFullYear()} Axia. {t('footer.rights')}
        </p>
      </div>
    </footer>
  )
}





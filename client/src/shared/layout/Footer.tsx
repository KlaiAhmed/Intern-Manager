import { useI18n } from '../i18n/I18nContext'

export function Footer() {
  const { t } = useI18n()

  return (
    <footer className="site-footer">
      <div className="container footer-content">
        <p>{t('footer.tagline')}</p>
        <p>
          © {new Date().getFullYear()} Axia. {t('footer.rights')}
        </p>
      </div>
    </footer>
  )
}

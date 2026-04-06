import { useI18n } from '../../../locales/I18nContext'
import styles from './index.module.css'

export function Footer() {
  const { t } = useI18n()

  return (
    <footer className={styles.siteFooter}>
      <div className={`container ${styles.footerContent}`}>
        <p>{t('footer.tagline')}</p>
        <p>
          (c) {new Date().getFullYear()} Axia. {t('footer.rights')}
        </p>
      </div>
    </footer>
  )
}





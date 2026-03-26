import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/I18nContext'
import { usePageMetadata } from '../seo/usePageMetadata'
import styles from './StatusPage.module.css'

/**
 * Affiche une page 404 moderne et coherente avec le style global de l'application.
 */
export function NotFoundPage() {
  const { t } = useI18n()

  usePageMetadata({
    title: t('error.meta.notFoundTitle'),
    description: t('error.meta.description'),
    path: '/404',
  })

  return (
    <main className={styles.page} id="main-content" tabIndex={-1}>
      <section className={styles.card} aria-labelledby="not-found-title">
        <p className={styles.code}>404</p>
        <h1 className={styles.title} id="not-found-title">
          {t('error.404.title')}
        </h1>
        <p className={styles.description}>{t('error.404.description')}</p>

        <div className={styles.actions}>
          <Link className="button button-primary button-md" to="/">
            {t('error.action.goHome')}
          </Link>
          <Link className="button button-secondary button-md" to="/login">
            {t('error.action.goLogin')}
          </Link>
        </div>
      </section>
    </main>
  )
}
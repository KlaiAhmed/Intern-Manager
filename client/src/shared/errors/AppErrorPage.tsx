import { Link } from 'react-router-dom'
import { useI18n } from '../../locales/I18nContext'
import { usePageMetadata } from '../../hooks/usePageMetadata'
import styles from './StatusPage.module.css'

interface AppErrorPageProps {
  onRetry?: () => void
}

/**
 * Affiche un ecran d'erreur global avec actions de recuperation utilisateur.
 */
export function AppErrorPage({ onRetry }: AppErrorPageProps) {
  const { t } = useI18n()

  usePageMetadata({
    title: t('error.meta.errorTitle'),
    description: t('error.meta.description'),
    path: '/error',
  })

  return (
    <main className={styles.page} id="main-content" tabIndex={-1}>
      <section className={styles.card} role="alert" aria-live="assertive" aria-labelledby="error-title">
        <p className={styles.code}>500</p>
        <h1 className={styles.title} id="error-title">
          {t('error.500.title')}
        </h1>
        <p className={styles.description}>{t('error.500.description')}</p>

        <div className={styles.actions}>
          <button className="button button-primary button-md" onClick={onRetry} type="button">
            {t('error.action.retry')}
          </button>
          <Link className="button button-secondary button-md" to="/">
            {t('error.action.goHome')}
          </Link>
        </div>
      </section>
    </main>
  )
}

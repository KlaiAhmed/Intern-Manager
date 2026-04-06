import type { PropsWithChildren } from 'react'
import { Header } from '../Header'
import { Footer } from '../Footer'
import { useI18n } from '../../../locales/I18nContext'
import styles from './index.module.css'

/**
 * Fournit la structure globale avec en-tete, contenu principal et pied de page.
 */
export function AppShell({ children }: PropsWithChildren) {
  const { t } = useI18n()

  return (
    <div className={styles.appShell}>
      <a className="skip-link" href="#main-content">
        {t('app.skipToMain')}
      </a>
      <Header />
      <div className={styles.appShellContent}>
        {children}
      </div>
      <Footer />
    </div>
  )
}





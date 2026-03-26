import type { PropsWithChildren } from 'react'
import { Header } from './Header'
import { Footer } from './Footer'
import { useI18n } from '../i18n/I18nContext'

/**
 * Fournit la structure globale avec en-tete, contenu principal et pied de page.
 */
export function AppShell({ children }: PropsWithChildren) {
  const { t } = useI18n()

  return (
    <>
      <a className="skip-link" href="#main-content">
        {t('app.skipToMain')}
      </a>
      <Header />
      {children}
      <Footer />
    </>
  )
}

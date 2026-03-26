import { BrowserRouter } from 'react-router-dom'
import type { PropsWithChildren } from 'react'
import { ThemeProvider } from '../../shared/theme/ThemeContext'
import { I18nProvider } from '../../shared/i18n/I18nContext'
import { RolePreferenceProvider } from '../../shared/state/RolePreferenceContext'

/**
 * Assemble les providers globaux de l'application dans un ordre stable.
 */
export function RootProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <RolePreferenceProvider>
          <BrowserRouter>{children}</BrowserRouter>
        </RolePreferenceProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}

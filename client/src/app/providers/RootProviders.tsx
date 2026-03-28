import { BrowserRouter } from 'react-router-dom'
import type { PropsWithChildren } from 'react'
import { ThemeProvider } from '../../shared/theme/ThemeContext'
import { I18nProvider } from '../../shared/i18n/I18nContext'
import { RolePreferenceProvider } from '../../shared/state/RolePreferenceContext'
import { AuthProvider } from '../../shared/state/AuthContext'

/**
 * Assemble les providers globaux de l'application dans un ordre stable.
 */
export function RootProviders({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <RolePreferenceProvider>
            <BrowserRouter>{children}</BrowserRouter>
          </RolePreferenceProvider>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  )
}

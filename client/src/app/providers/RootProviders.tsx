import { BrowserRouter } from 'react-router-dom'
import type { PropsWithChildren } from 'react'
import { ThemeProvider } from '../../stores/ThemeContext'
import { I18nProvider } from '../../locales/I18nContext'
import { RolePreferenceProvider } from '../../stores/RolePreferenceContext'
import { AuthProvider } from '../../stores/AuthContext'

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


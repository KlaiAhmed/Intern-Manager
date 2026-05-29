import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { ThemeProvider } from '../../stores/ThemeContext'
import { I18nProvider } from '../../locales/I18nContext'
import { RolePreferenceProvider } from '../../stores/RolePreferenceContext'
import { AuthProvider } from '../../stores/AuthContext'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
})

/**
 * Assemble les providers globaux de l'application dans un ordre stable.
 */
export function RootProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <RolePreferenceProvider>
              <BrowserRouter>{children}</BrowserRouter>
            </RolePreferenceProvider>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}


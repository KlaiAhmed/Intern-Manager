import { Route, Routes } from 'react-router-dom'
import { AppShell } from '../../shared/layout/AppShell'
import { HomePage } from '../../features/home/pages/HomePage'
import { LoginPage } from '../../features/auth/pages/LoginPage'
import { SignInPage } from '../../features/auth/pages/SignInPage'
import { NotFoundPage } from '../../shared/errors/NotFoundPage'
import { AppErrorPage } from '../../shared/errors/AppErrorPage'

export function AppRouter() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppShell>
            <HomePage />
          </AppShell>
        }
      />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="/error" element={<AppErrorPage onRetry={() => window.location.reload()} />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

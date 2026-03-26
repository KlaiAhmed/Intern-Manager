import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '../../shared/layout/AppShell'
import { HomePage } from '../../features/home/pages/HomePage'

function NotFoundPage() {
  return (
    <main className="container narrow-flow" id="main-content" tabIndex={-1}>
      <section className="surface-card">
        <h1>Page not found</h1>
        <p>The page you requested does not exist.</p>
      </section>
    </main>
  )
}

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
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate replace to="/404" />} />
    </Routes>
  )
}

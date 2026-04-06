import { AppRouter } from '../routes/AppRouter'
import { AppErrorBoundary } from '../shared/errors/AppErrorBoundary'
import { useAuth } from '../stores/AuthContext'

export default function App() {
  const { isAuthLoading } = useAuth()

  if (isAuthLoading) {
    return null
  }

  return (
    <AppErrorBoundary>
      <AppRouter />
    </AppErrorBoundary>
  )
}

import { AppRouter } from './routes/AppRouter'
import { AppErrorBoundary } from '../shared/errors/AppErrorBoundary'

export default function App() {
  return (
    <AppErrorBoundary>
      <AppRouter />
    </AppErrorBoundary>
  )
}

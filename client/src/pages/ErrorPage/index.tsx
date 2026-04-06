import { AppErrorPage } from '../../shared/errors/AppErrorPage'

export function ErrorPage() {
  return <AppErrorPage onRetry={() => window.location.reload()} />
}

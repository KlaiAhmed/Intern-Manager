import type { ErrorInfo, PropsWithChildren, ReactNode } from 'react'
import { Component } from 'react'
import { AppErrorPage } from './AppErrorPage'

interface AppErrorBoundaryState {
  hasError: boolean
}

interface AppErrorBoundaryCoreProps extends PropsWithChildren {
  fallback: ReactNode
}

class AppErrorBoundaryCore extends Component<AppErrorBoundaryCoreProps, AppErrorBoundaryState> {
  public state: AppErrorBoundaryState = {
    hasError: false,
  }

  public static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Erreur non geree capturee par AppErrorBoundary:', error, errorInfo)
  }

  public componentDidUpdate(previousProps: AppErrorBoundaryCoreProps): void {
    if (this.state.hasError && previousProps.children !== this.props.children) {
      this.setState({ hasError: false })
    }
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback
    }

    return this.props.children
  }
}

/**
 * Encapsule l'application dans une frontiere d'erreur React pour afficher un fallback propre.
 */
export function AppErrorBoundary({ children }: PropsWithChildren) {
  const handleRetry = () => {
    window.location.reload()
  }

  return (
    <AppErrorBoundaryCore fallback={<AppErrorPage onRetry={handleRetry} />}>
      {children}
    </AppErrorBoundaryCore>
  )
}
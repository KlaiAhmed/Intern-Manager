import { Component, type ErrorInfo, type ReactNode } from 'react'
import { TabErrorFallback } from './TabErrorFallback'

export interface TabErrorBoundaryFallbackProps {
  error: Error
  retry: () => void
}

interface TabErrorBoundaryProps {
  children: ReactNode
  fallback?: (props: TabErrorBoundaryFallbackProps) => ReactNode
  fallbackTitle?: string
  fallbackMessage?: string
  retryLabel?: string
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  resetKeys?: readonly unknown[]
}

interface TabErrorBoundaryState {
  error: Error | null
}

function areResetKeysEqual(previousKeys: readonly unknown[] = [], nextKeys: readonly unknown[] = []) {
  if (previousKeys.length !== nextKeys.length) {
    return false
  }

  return previousKeys.every((previousKey, index) => Object.is(previousKey, nextKeys[index]))
}

export class TabErrorBoundary extends Component<TabErrorBoundaryProps, TabErrorBoundaryState> {
  state: TabErrorBoundaryState = {
    error: null,
  }

  static getDerivedStateFromError(error: Error): TabErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo)
  }

  componentDidUpdate(previousProps: TabErrorBoundaryProps) {
    if (!this.state.error) {
      return
    }

    if (!areResetKeysEqual(previousProps.resetKeys, this.props.resetKeys)) {
      this.resetBoundary()
    }
  }

  resetBoundary = () => {
    this.setState({ error: null })
  }

  render() {
    const { children, fallback, fallbackMessage, fallbackTitle, retryLabel } = this.props
    const { error } = this.state

    if (!error) {
      return children
    }

    if (fallback) {
      return fallback({
        error,
        retry: this.resetBoundary,
      })
    }

    return (
      <TabErrorFallback
        title={fallbackTitle}
        message={fallbackMessage}
        retryLabel={retryLabel}
        onRetry={this.resetBoundary}
      />
    )
  }
}

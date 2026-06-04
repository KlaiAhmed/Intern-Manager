import { Component, type ReactNode } from 'react'
import { ErrorState } from './ErrorState'

interface TabErrorBoundaryProps {
  resetKeys?: (string | null)[]
  children: ReactNode
}

interface TabErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class TabErrorBoundary extends Component<TabErrorBoundaryProps, TabErrorBoundaryState> {
  state: TabErrorBoundaryState = {
    hasError: false,
    error: null,
  }

  static getDerivedStateFromError(error: Error): TabErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidUpdate(prevProps: TabErrorBoundaryProps) {
    if (!this.state.hasError) {
      return
    }

    if (JSON.stringify(prevProps.resetKeys ?? []) !== JSON.stringify(this.props.resetKeys ?? [])) {
      this.setState({ hasError: false, error: null })
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return <ErrorState message={this.state.error?.message ?? ''} onRetry={this.handleRetry} />
    }

    return this.props.children
  }
}

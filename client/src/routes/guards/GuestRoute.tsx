import type { PropsWithChildren } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../stores/AuthContext'

/**
 * Guard component that prevents authenticated users from accessing guest-only routes
 * (like /login and /signup). Redirects to dashboard if already logged in.
 */
export function GuestRoute({ children }: PropsWithChildren) {
  const { isLoggedIn, isAuthLoading } = useAuth()

  if (isAuthLoading) {
    return (
      <div className="protected-route-loading">
        <div className="loading-spinner" aria-label="Loading..." />
      </div>
    )
  }

  if (isLoggedIn) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

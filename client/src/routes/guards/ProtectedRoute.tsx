import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../stores/AuthContext'

interface ProtectedRouteProps extends PropsWithChildren {
  allowedRoles?: string[]
}

function normalizeRole(rawRole: string | undefined): string {
  if (!rawRole) {
    return ''
  }

  return rawRole.trim().toLowerCase().replace(/[\s-]/g, '_')
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isLoggedIn, isAuthLoading, user } = useAuth()
  const location = useLocation()

  if (isAuthLoading) {
    return (
      <div className="protected-route-loading">
        <div className="loading-spinner" aria-label="Loading..." />
      </div>
    )
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const normalizedRole = normalizeRole(user?.role)
    const normalizedAllowedRoles = allowedRoles.map((role) => normalizeRole(role))

    if (!normalizedAllowedRoles.includes(normalizedRole)) {
      return <Navigate to="/dashboard" replace />
    }
  }

  return <>{children}</>
}

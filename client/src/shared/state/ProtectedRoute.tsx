import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

/**
 * Protège une route en redirigeant vers /login si l'utilisateur n'est pas authentifié.
 * Affiche un état de chargement pendant la vérification de l'authentification.
 */
export function ProtectedRoute({ children }: PropsWithChildren) {
  const { isLoggedIn, isAuthLoading } = useAuth()
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

  return <>{children}</>
}

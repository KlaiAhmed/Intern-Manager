import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import {
  initializeCurrentUser,
  loginWithPassword,
  logoutCurrentUser,
  type AuthUser,
} from '../api/authApi'

interface AuthContextValue {
  isLoggedIn: boolean
  isAuthLoading: boolean
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshCurrentUser: () => Promise<AuthUser | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Fournit l'etat d'authentification global et synchronise l'utilisateur courant avec l'API.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const [isAuthLoading, setIsAuthLoading] = useState(true)
  const [user, setUser] = useState<AuthUser | null>(null)

  const refreshCurrentUser = async (): Promise<AuthUser | null> => {
    const currentUser = await initializeCurrentUser()
    setUser(currentUser)
    return currentUser
  }

  const login = async (email: string, password: string): Promise<void> => {
    const currentUser = await loginWithPassword(email, password)
    setUser(currentUser)
  }

  const logout = async (): Promise<void> => {
    await logoutCurrentUser()
    setUser(null)
  }

  useEffect(() => {
    let isCancelled = false

    const bootstrapAuth = async (): Promise<void> => {
      if (!isCancelled) {
        setIsAuthLoading(true)
      }

      try {
        const currentUser = await initializeCurrentUser()

        if (!isCancelled) {
          setUser(currentUser)
        }
      } catch {
        if (!isCancelled) {
          setUser(null)
        }
      } finally {
        if (!isCancelled) {
          setIsAuthLoading(false)
        }
      }
    }

    void bootstrapAuth()

    return () => {
      isCancelled = true
    }
  }, [])

  const contextValue = useMemo<AuthContextValue>(() => {
    return {
      isLoggedIn: Boolean(user),
      isAuthLoading,
      user,
      login,
      logout,
      refreshCurrentUser,
    }
  }, [isAuthLoading, user])

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.')
  }

  return context
}
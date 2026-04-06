import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import {
  initializeCurrentUser,
  loginWithPassword,
  logoutCurrentUser,
  signupWithPassword,
  type AuthUser,
} from '../lib/authApi'
import { setApiAuthStateListener } from '../lib/apiClient'
import type { UserRole } from '../types/role'

interface AuthContextValue {
  isLoggedIn: boolean
  isAuthLoading: boolean
  user: AuthUser | null
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>
  signup: (firstName: string, lastName: string, email: string, password: string, role: UserRole) => Promise<void>
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

  const login = async (email: string, password: string, rememberMe: boolean = false): Promise<void> => {
    const currentUser = await loginWithPassword(email, password, rememberMe)
    setUser(currentUser)
  }

  const signup = async (
    firstName: string,
    lastName: string,
    email: string,
    password: string,
    role: UserRole,
  ): Promise<void> => {
    const currentUser = await signupWithPassword({
      firstName,
      lastName,
      email,
      password,
      role,
    })

    setUser(currentUser)
  }

  const logout = async (): Promise<void> => {
    await logoutCurrentUser()
    setUser(null)
  }

  useEffect(() => {
    let isDisposed = false

    setApiAuthStateListener((state) => {
      if (isDisposed) {
        return
      }

      if (state === 'logged-out') {
        setUser(null)
        setIsAuthLoading(false)
        return
      }

      void (async () => {
        try {
          const currentUser = await initializeCurrentUser()

          if (!isDisposed) {
            setUser(currentUser)
          }
        } catch {
          if (!isDisposed) {
            setUser(null)
          }
        }
      })()
    })

    return () => {
      isDisposed = true
      setApiAuthStateListener(null)
    }
  }, [])

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
      signup,
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
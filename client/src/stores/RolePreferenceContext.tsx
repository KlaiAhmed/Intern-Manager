import { createContext, useContext, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { storageKeys } from '../config/storageKeys'
import { availableRoles, type UserRole } from '../types/role'

interface RolePreferenceContextValue {
  activeRole: UserRole
  setActiveRole: (nextRole: UserRole) => void
}

const RolePreferenceContext = createContext<RolePreferenceContextValue | null>(null)

function detectInitialRole(): UserRole {
  if (typeof window === 'undefined') {
    return 'manager'
  }

  const persistedRole = window.localStorage.getItem(storageKeys.role)
  if (persistedRole && availableRoles.includes(persistedRole as UserRole)) {
    return persistedRole as UserRole
  }

  return 'manager'
}

/**
 * Conserve la perspective role pour personnaliser les contenus de landing.
 */
export function RolePreferenceProvider({ children }: PropsWithChildren) {
  const [activeRole, setActiveRoleState] = useState<UserRole>(() => detectInitialRole())

  const setActiveRole = (nextRole: UserRole): void => {
    setActiveRoleState(nextRole)
    window.localStorage.setItem(storageKeys.role, nextRole)
  }

  const contextValue = useMemo<RolePreferenceContextValue>(() => {
    return {
      activeRole,
      setActiveRole,
    }
  }, [activeRole])

  return <RolePreferenceContext.Provider value={contextValue}>{children}</RolePreferenceContext.Provider>
}

export function useRolePreference(): RolePreferenceContextValue {
  const context = useContext(RolePreferenceContext)

  if (!context) {
    throw new Error('useRolePreference must be used within RolePreferenceProvider.')
  }

  return context
}

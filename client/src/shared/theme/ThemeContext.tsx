import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { storageKeys } from '../constants/storageKeys'

export const themeModes = ['light', 'dark', 'system'] as const

export type ThemeMode = (typeof themeModes)[number]
export type ResolvedTheme = Exclude<ThemeMode, 'system'>

interface ThemeContextValue {
  themeMode: ThemeMode
  resolvedTheme: ResolvedTheme
  setThemeMode: (nextTheme: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function detectSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function detectInitialThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'system'
  }

  const persistedMode = window.localStorage.getItem(storageKeys.themeMode)
  if (persistedMode && themeModes.includes(persistedMode as ThemeMode)) {
    return persistedMode as ThemeMode
  }

  return 'system'
}

/**
 * Gere le mode de theme (clair/sombre/systeme) et expose le theme resolu.
 */
export function ThemeProvider({ children }: PropsWithChildren) {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => detectInitialThemeMode())
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => detectSystemTheme())

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const listener = (event: MediaQueryListEvent): void => {
      setSystemTheme(event.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', listener)
    return () => mediaQuery.removeEventListener('change', listener)
  }, [])

  const resolvedTheme = themeMode === 'system' ? systemTheme : themeMode

  useEffect(() => {
    window.localStorage.setItem(storageKeys.themeMode, themeMode)
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.style.colorScheme = resolvedTheme
  }, [themeMode, resolvedTheme])

  const contextValue = useMemo<ThemeContextValue>(() => {
    return {
      themeMode,
      resolvedTheme,
      setThemeMode,
    }
  }, [themeMode, resolvedTheme])

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider.')
  }

  return context
}

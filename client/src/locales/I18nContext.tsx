import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import type { PropsWithChildren } from 'react'
import { storageKeys } from '../config/storageKeys'
import {
  supportedLocales,
  loadLocaleDictionary,
  getFallbackDictionary,
  type SupportedLocale,
  type TranslationKey,
} from './index'
import type { TranslationMap } from './types'

interface I18nContextValue {
  locale: SupportedLocale
  isRtl: boolean
  isLoading: boolean
  setLocale: (nextLocale: SupportedLocale) => void
  t: (key: TranslationKey, interpolationValues?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, varName: string) => {
    const value = values[varName]
    return value !== undefined ? String(value) : `{{${varName}}}`
  })
}

function normalizeLocale(localeCandidate: string): SupportedLocale | null {
  const shortLocale = localeCandidate.slice(0, 2).toLowerCase()

  if (supportedLocales.includes(shortLocale as SupportedLocale)) {
    return shortLocale as SupportedLocale
  }

  return null
}

function detectInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') {
    return 'en'
  }

  const persistedLocale = window.localStorage.getItem(storageKeys.locale)
  if (persistedLocale && supportedLocales.includes(persistedLocale as SupportedLocale)) {
    return persistedLocale as SupportedLocale
  }

  const browserLocales = [...(window.navigator.languages ?? []), window.navigator.language].filter(Boolean)

  for (const localeCandidate of browserLocales) {
    const normalizedLocale = normalizeLocale(localeCandidate)

    if (normalizedLocale) {
      return normalizedLocale
    }
  }

  return 'en'
}

function readTranslation(dictionary: TranslationMap, key: TranslationKey): string | null {
  const value = dictionary[key]

  if (typeof value === 'string') {
    return value
  }

  return null
}

const fallbackDictionary = getFallbackDictionary()

export function I18nProvider({ children }: PropsWithChildren) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => detectInitialLocale())
  const [dictionary, setDictionary] = useState<TranslationMap>(() => {
    // If initial locale is English, use pre-loaded dictionary
    const initialLocale = detectInitialLocale()
    if (initialLocale === 'en') {
      return fallbackDictionary
    }
    // For other locales, start with fallback and load async
    return fallbackDictionary
  })
  const [isLoading, setIsLoading] = useState(() => locale !== 'en')

  // Load locale dictionary when locale changes
  useEffect(() => {
    let isCancelled = false

    const loadDictionary = async () => {
      if (locale === 'en') {
        if (!isCancelled) {
          setDictionary(fallbackDictionary)
          setIsLoading(false)
        }
        return
      }

      setIsLoading(true)

      try {
        const loadedDictionary = await loadLocaleDictionary(locale)
        if (!isCancelled) {
          setDictionary(loadedDictionary)
        }
      } catch (error) {
        console.error(`Failed to load locale ${locale}:`, error)
        // Fall back to English on error
        if (!isCancelled) {
          setDictionary(fallbackDictionary)
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    loadDictionary()

    return () => {
      isCancelled = true
    }
  }, [locale])

  // Persist locale and update document attributes
  useEffect(() => {
    window.localStorage.setItem(storageKeys.locale, locale)
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
  }, [locale])

  const setLocale = useCallback((nextLocale: SupportedLocale) => {
    setLocaleState(nextLocale)
  }, [])

  const contextValue = useMemo<I18nContextValue>(() => {
    const isRtl = locale === 'ar'

    return {
      locale,
      isRtl,
      isLoading,
      setLocale,
      t: (key: TranslationKey, interpolationValues?: Record<string, string | number>): string => {
        const localizedValue = readTranslation(dictionary, key)
        const fallbackValue = readTranslation(fallbackDictionary, key)
        const rawValue = localizedValue ?? fallbackValue ?? key

        if (interpolationValues && typeof rawValue === 'string') {
          return interpolate(rawValue, interpolationValues)
        }

        return rawValue
      },
    }
  }, [locale, isLoading, setLocale, dictionary])

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error('useI18n must be used within I18nProvider.')
  }

  return context
}

export { supportedLocales }
export type { SupportedLocale, TranslationKey }

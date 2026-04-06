import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { storageKeys } from '../config/storageKeys'
import {
  supportedLocales,
  translationDictionaries,
  type SupportedLocale,
  type TranslationKey,
} from './index'
import type { TranslationMap } from './types'

interface I18nContextValue {
  locale: SupportedLocale
  isRtl: boolean
  setLocale: (nextLocale: SupportedLocale) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

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

export function I18nProvider({ children }: PropsWithChildren) {
  const [locale, setLocale] = useState<SupportedLocale>(() => detectInitialLocale())

  useEffect(() => {
    window.localStorage.setItem(storageKeys.locale, locale)
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
  }, [locale])

  const contextValue = useMemo<I18nContextValue>(() => {
    const isRtl = locale === 'ar'

    return {
      locale,
      isRtl,
      setLocale,
      t: (key: TranslationKey): string => {
        const localizedValue = readTranslation(translationDictionaries[locale], key)
        const fallbackValue = readTranslation(translationDictionaries.en, key)

        return localizedValue ?? fallbackValue ?? key
      },
    }
  }, [locale])

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

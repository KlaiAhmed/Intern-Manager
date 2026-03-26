import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { storageKeys } from '../constants/storageKeys'
import { arTranslations } from './translations/ar'
import { enTranslations } from './translations/en'
import { frTranslations } from './translations/fr'

export const supportedLocales = ['en', 'fr', 'ar'] as const

export type SupportedLocale = (typeof supportedLocales)[number]
export type TranslationKey = keyof typeof enTranslations

type TranslationDictionary = Record<SupportedLocale, Record<TranslationKey, string>>

const translationDictionaries: TranslationDictionary = {
  en: enTranslations,
  fr: frTranslations,
  ar: arTranslations,
}

interface I18nContextValue {
  locale: SupportedLocale
  isRtl: boolean
  setLocale: (nextLocale: SupportedLocale) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function detectInitialLocale(): SupportedLocale {
  if (typeof window === 'undefined') {
    return 'en'
  }

  const persistedLocale = window.localStorage.getItem(storageKeys.locale)
  if (persistedLocale && supportedLocales.includes(persistedLocale as SupportedLocale)) {
    return persistedLocale as SupportedLocale
  }

  const browserLocale = window.navigator.language.slice(0, 2).toLowerCase()
  if (supportedLocales.includes(browserLocale as SupportedLocale)) {
    return browserLocale as SupportedLocale
  }

  return 'en'
}

/**
 * Fournit la localisation et la gestion RTL a toute l'application.
 */
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
        return translationDictionaries[locale][key] ?? translationDictionaries.en[key] ?? key
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

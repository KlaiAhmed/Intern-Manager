import type { LanguageCode, TranslationMap, Translations } from './types'

export const supportedLocales = ['en', 'fr', 'ar'] as const

export type SupportedLocale = (typeof supportedLocales)[number]
export type TranslationKey = string

// Synchronously import only English as the default/fallback locale
import { commonEn } from './en'

// Feature locale bundles for English (imported synchronously for default)
import { authLocales } from '../features/auth/locales'
import { dashboardLocales } from '../features/dashboard/locales'
import { homeLocales } from '../features/home/locales'
import { notificationsLocales } from '../features/notifications/locales'

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function deepMergeMaps(baseMap: TranslationMap, overlayMap: TranslationMap): TranslationMap {
  const mergedMap: TranslationMap = { ...baseMap }

  for (const [key, overlayValue] of Object.entries(overlayMap)) {
    const baseValue = mergedMap[key]

    if (isPlainObject(baseValue) && isPlainObject(overlayValue)) {
      mergedMap[key] = deepMergeMaps(baseValue, overlayValue)
      continue
    }

    mergedMap[key] = overlayValue
  }

  return mergedMap
}

// Build English dictionary synchronously (default/fallback)
const featureLocaleBundlesEn: Array<Record<LanguageCode, TranslationMap>> = [
  authLocales,
  dashboardLocales,
  homeLocales,
  notificationsLocales,
]

function buildDictionaryForLanguage(
  language: LanguageCode,
  commonDictionary: TranslationMap,
  featureBundles: Array<Record<LanguageCode, TranslationMap>>,
): TranslationMap {
  return featureBundles.reduce((mergedDictionary, localeBundle) => {
    return deepMergeMaps(mergedDictionary, localeBundle[language] ?? {})
  }, commonDictionary)
}

// Pre-built English dictionary (synchronously available)
export const enDictionary: TranslationMap = buildDictionaryForLanguage('en', commonEn, featureLocaleBundlesEn)

// Cache for loaded dictionaries
const loadedDictionaries: Partial<Translations> = {
  en: enDictionary,
}

// Dynamic import functions for lazy loading
const localeLoaders: Record<LanguageCode, () => Promise<TranslationMap>> = {
  en: async () => enDictionary, // Already loaded
  fr: async () => {
    const [{ commonFr }, { authLocales }, { dashboardLocales }, { homeLocales }, { notificationsLocales }] =
      await Promise.all([
        import('./fr'),
        import('../features/auth/locales'),
        import('../features/dashboard/locales'),
        import('../features/home/locales'),
        import('../features/notifications/locales'),
      ])

    const featureBundles = [authLocales, dashboardLocales, homeLocales, notificationsLocales]
    return buildDictionaryForLanguage('fr', commonFr, featureBundles)
  },
  ar: async () => {
    const [{ commonAr }, { authLocales }, { dashboardLocales }, { homeLocales }, { notificationsLocales }] =
      await Promise.all([
        import('./ar'),
        import('../features/auth/locales'),
        import('../features/dashboard/locales'),
        import('../features/home/locales'),
        import('../features/notifications/locales'),
      ])

    const featureBundles = [authLocales, dashboardLocales, homeLocales, notificationsLocales]
    return buildDictionaryForLanguage('ar', commonAr, featureBundles)
  },
}

/**
 * Load a locale dictionary. Returns cached version if available.
 * English is always available synchronously as the fallback.
 */
export async function loadLocaleDictionary(locale: LanguageCode): Promise<TranslationMap> {
  const cached = loadedDictionaries[locale]
  if (cached) {
    return cached
  }

  const dictionary = await localeLoaders[locale]()
  loadedDictionaries[locale] = dictionary
  return dictionary
}

/**
 * Get the synchronous fallback dictionary (English).
 * Used for initial render before async load completes.
 */
export function getFallbackDictionary(): TranslationMap {
  return enDictionary
}

// Deprecated: keeping for backwards compatibility during transition
// This will be removed after I18nContext refactoring
export const translationDictionaries: Translations = {
  en: enDictionary,
  fr: {}, // Empty placeholder - loaded lazily
  ar: {}, // Empty placeholder - loaded lazily
}

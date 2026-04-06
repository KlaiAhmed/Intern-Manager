import { authLocales } from '../features/auth/locales'
import { dashboardLocales } from '../features/dashboard/locales'
import { homeLocales } from '../features/home/locales'
import { notificationsLocales } from '../features/notifications/locales'
import { commonAr } from './ar'
import { commonEn } from './en'
import { commonFr } from './fr'
import type { LanguageCode, TranslationMap, Translations } from './types'

export const supportedLocales = ['en', 'fr', 'ar'] as const

export type SupportedLocale = (typeof supportedLocales)[number]
export type TranslationKey = string

const featureLocaleBundles: Array<Record<LanguageCode, TranslationMap>> = [
  authLocales,
  dashboardLocales,
  homeLocales,
  notificationsLocales,
]

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

function mergeLanguageDictionaries(language: LanguageCode, commonDictionary: TranslationMap): TranslationMap {
  return featureLocaleBundles.reduce((mergedDictionary, localeBundle) => {
    return deepMergeMaps(mergedDictionary, localeBundle[language] ?? {})
  }, commonDictionary)
}

export const translationDictionaries: Translations = {
  en: mergeLanguageDictionaries('en', commonEn),
  fr: mergeLanguageDictionaries('fr', commonFr),
  ar: mergeLanguageDictionaries('ar', commonAr),
}

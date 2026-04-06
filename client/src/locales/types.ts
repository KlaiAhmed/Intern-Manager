export type LanguageCode = 'en' | 'fr' | 'ar'

export type TranslationMap = Record<string, unknown>

export type Translations = Record<LanguageCode, TranslationMap>

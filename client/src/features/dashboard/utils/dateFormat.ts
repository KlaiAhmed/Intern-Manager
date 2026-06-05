import type { Locale } from 'date-fns'
import { enUS, fr, ar } from 'date-fns/locale'
import { format } from 'date-fns'
import type { SupportedLocale } from '@/locales/I18nContext'

UiA
const localeMap: Record<SupportedLocale, Locale> = {
  en: enUS,
  fr,
  ar,
}

/**
 * Format a date using a named pattern that is mapped to a locale-aware date-fns format.
 *
 * Supported patterns:
 * - 'shortDate'      → e.g. "Jun 1, 2026"  (previously 'MMM d, yyyy')
 * - 'longDate'       → e.g. "June 1, 2026" (previously 'PP')
 * - 'longDateTime'   → e.g. "June 1, 2026 at 2:30 PM" (previously 'PPp')
 * - 'shortDateTime'  → e.g. "Jun 1, 2026 14:30" (previously 'MMM d, yyyy HH:mm')
 * - 'monthYear'      → e.g. "June 2026" (previously 'MMMM yyyy')
 */
export function formatLocalizedDate(
  date: Date,
  pattern: 'shortDate' | 'longDate' | 'longDateTime' | 'shortDateTime' | 'monthYear',
  locale: SupportedLocale,
): string {
  const dateLocale = localeMap[locale] ?? enUS

  const patternMap: Record<typeof pattern, string> = {
    shortDate: 'PPP',      // e.g. Jun 1, 2026
    longDate: 'PP',        // e.g. June 1, 2026
    longDateTime: 'PPp',   // e.g. June 1, 2026 at 2:30 PM
    shortDateTime: 'PPPp', // e.g. Jun 1, 2026 2:30 PM
    monthYear: 'MMMM yyyy', // e.g. June 2026
  }

  return format(date, patternMap[pattern], { locale: dateLocale })
}

/**
 * Safe date parsing: tries to parse an ISO or standard string and returns null if invalid.
 */
export function safeParseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

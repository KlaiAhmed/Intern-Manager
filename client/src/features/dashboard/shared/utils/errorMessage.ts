export function toDashboardErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return 'Unable to complete the request. Please retry.'
}

/**
 * Get an error message with i18n fallback.
 * @param error - The caught error
 * @param fallback - The localized fallback message (e.g., t('dashboard.error.load'))
 * @returns The error message or fallback
 */
export function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }
  return fallback
}

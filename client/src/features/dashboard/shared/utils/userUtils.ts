/**
 * Shared user-related utilities for dashboard components.
 */

/**
 * Extract initials from a name string.
 * @param name - The full name
 * @param fallback - Fallback value when name is empty (default: '')
 * @returns Up to 2 uppercase initials
 */
export function getInitials(name: string, fallback: string = ''): string {
  if (!name.trim()) return fallback
  return name
    .split(' ')
    .map((segment) => segment[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/**
 * Extract first name from a full name string.
 * @param name - The full name
 * @returns The first name, or empty string if name is empty
 */
export function getFirstName(name: string): string {
  if (!name.trim()) return ''
  return name.split(' ')[0] ?? ''
}

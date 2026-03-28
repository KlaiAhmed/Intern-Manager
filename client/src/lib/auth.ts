const defaultCsrfCookieName = 'csrf_token'

export function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const cookiePrefix = `${encodeURIComponent(name)}=`
  const cookies = document.cookie.split(';')

  for (const cookiePart of cookies) {
    const entry = cookiePart.trim()
    if (entry.startsWith(cookiePrefix)) {
      return decodeURIComponent(entry.slice(cookiePrefix.length))
    }
  }

  return null
}

export function getCsrfCookieToken(): string | null {
  return readCookie(defaultCsrfCookieName)
}
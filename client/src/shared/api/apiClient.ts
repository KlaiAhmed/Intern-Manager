const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL

if (!rawApiBaseUrl || !rawApiBaseUrl.trim()) {
  throw new Error('VITE_API_BASE_URL must be defined in the environment variables.')
}

export const apiBaseUrl = rawApiBaseUrl.trim().replace(/\/+$/, '')

function normalizePath(path: string): string {
  if (!path) {
    return '/'
  }

  return path.startsWith('/') ? path : `/${path}`
}

export function buildApiUrl(path: string): string {
  return `${apiBaseUrl}${normalizePath(path)}`
}

interface ApiFetchOptions extends RequestInit {
  omitJsonAcceptHeader?: boolean
}

export function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const headers = new Headers(options.headers)

  if (!options.omitJsonAcceptHeader && !headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  return fetch(buildApiUrl(path), {
    ...options,
    credentials: 'include',
    headers,
  })
}
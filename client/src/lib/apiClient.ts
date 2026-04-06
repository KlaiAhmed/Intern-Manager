import { getCsrfCookieToken } from './auth'

const rawApiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL

if (!rawApiBaseUrl || !rawApiBaseUrl.trim()) {
  throw new Error('VITE_API_BASE_URL (or VITE_API_URL) must be defined in the environment variables.')
}

export const apiBaseUrl = rawApiBaseUrl.trim().replace(/\/+$/, '')

const refreshPath = '/auth/refresh'
const logoutPath = '/auth/logout'

type ApiAuthState = 'logged-in' | 'logged-out'
type ApiAuthStateListener = (state: ApiAuthState) => void

let inFlightRefreshRequest: Promise<boolean> | null = null
let inFlightLogoutTransition: Promise<void> | null = null
let apiAuthStateListener: ApiAuthStateListener | null = null

function normalizePath(path: string): string {
  if (!path) {
    return '/'
  }

  return path.startsWith('/') ? path : `/${path}`
}

function normalizePathForMatching(path: string): string {
  const normalized = normalizePath(path)
  const [pathWithoutQuery] = normalized.split('?')
  return pathWithoutQuery.replace(/\/+$/, '').toLowerCase() || '/'
}

function isRefreshOrLogoutPath(path: string): boolean {
  const normalizedPath = normalizePathForMatching(path)
  return normalizedPath === refreshPath || normalizedPath === logoutPath
}

function notifyAuthState(state: ApiAuthState): void {
  apiAuthStateListener?.(state)
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') {
    return
  }

  if (window.location.pathname.toLowerCase() === '/login') {
    return
  }

  window.location.assign('/login')
}

function buildHeaders(headersInit: HeadersInit | undefined, omitJsonAcceptHeader: boolean | undefined): Headers {
  const headers = new Headers(headersInit)

  if (!omitJsonAcceptHeader && !headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  if (headers.has('X-CSRF-Token')) {
    const csrfToken = getCsrfCookieToken()

    if (csrfToken) {
      headers.set('X-CSRF-Token', csrfToken)
    } else {
      headers.delete('X-CSRF-Token')
    }
  }

  return headers
}

function buildRequestInit(options: ApiFetchOptions): RequestInit {
  const { omitJsonAcceptHeader, ...requestOptions } = options

  return {
    ...requestOptions,
    credentials: 'include',
    headers: buildHeaders(requestOptions.headers, omitJsonAcceptHeader),
  }
}

async function requestRefreshToken(): Promise<boolean> {
  try {
    const response = await fetch(buildApiUrl(refreshPath), {
      method: 'POST',
      credentials: 'include',
      headers: new Headers({
        Accept: 'application/json',
      }),
    })

    return response.ok
  } catch {
    return false
  }
}

async function refreshTokenOnce(): Promise<boolean> {
  if (inFlightRefreshRequest) {
    return inFlightRefreshRequest
  }

  inFlightRefreshRequest = (async () => {
    try {
      return await requestRefreshToken()
    } finally {
      inFlightRefreshRequest = null
    }
  })()

  return inFlightRefreshRequest
}

async function requestServerLogout(): Promise<void> {
  const headers = new Headers({
    Accept: 'application/json',
  })

  const csrfToken = getCsrfCookieToken()
  if (csrfToken) {
    headers.set('X-CSRF-Token', csrfToken)
  }

  try {
    await fetch(buildApiUrl(logoutPath), {
      method: 'POST',
      credentials: 'include',
      headers,
    })
  } catch {
    // Swallow errors: local auth reset and redirect must still happen.
  }
}

function markLoggedOutAndRedirect(): void {
  notifyAuthState('logged-out')
  redirectToLogin()
}

async function runLogoutTransition(): Promise<void> {
  if (inFlightLogoutTransition) {
    return inFlightLogoutTransition
  }

  inFlightLogoutTransition = (async () => {
    await requestServerLogout()
    markLoggedOutAndRedirect()
  })().finally(() => {
    inFlightLogoutTransition = null
  })

  return inFlightLogoutTransition
}

export function setApiAuthStateListener(listener: ApiAuthStateListener | null): void {
  apiAuthStateListener = listener
}

export function buildApiUrl(path: string): string {
  return `${apiBaseUrl}${normalizePath(path)}`
}

interface ApiFetchOptions extends RequestInit {
  omitJsonAcceptHeader?: boolean
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const requestUrl = buildApiUrl(path)
  const response = await fetch(requestUrl, buildRequestInit(options))

  if (response.status !== 401 || isRefreshOrLogoutPath(path)) {
    return response
  }

  if (!getCsrfCookieToken()) {
    markLoggedOutAndRedirect()
    return response
  }

  const didRefreshSucceed = await refreshTokenOnce()

  if (!didRefreshSucceed) {
    await runLogoutTransition()
    return response
  }

  notifyAuthState('logged-in')
  return fetch(requestUrl, buildRequestInit(options))
}
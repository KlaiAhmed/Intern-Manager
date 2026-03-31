import { getCsrfCookieToken } from '../../lib/auth'
import { apiFetch } from './apiClient'

export interface AuthUser {
  id: string | null
  name: string
  email: string
  role: string
}

export interface SignupPayload {
  firstName: string
  lastName: string
  email: string
  password: string
  role: string
}

interface UserSummaryResponse {
  id: string
  fullName?: string
  role?: string
  department?: string
  status?: string
  email?: string
  firstName?: string
  lastName?: string
}

type JsonRecord = Record<string, unknown>

interface CurrentUserRequestResult {
  status: 'ok' | 'unauthorized'
  user: AuthUser | null
}

let refreshPromise: Promise<boolean> | null = null
let authInitializationPromise: Promise<AuthUser | null> | null = null

export class ApiRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function getFirstValidationMessage(errors: unknown): string | null {
  if (!isJsonRecord(errors)) {
    return null
  }

  for (const validationValue of Object.values(errors)) {
    if (Array.isArray(validationValue)) {
      const firstMessage = validationValue.find((item): item is string => typeof item === 'string')
      if (firstMessage) {
        return firstMessage
      }
    }
  }

  return null
}

async function readResponseMessage(response: Response): Promise<string | null> {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    try {
      const payload: unknown = await response.json()

      if (typeof payload === 'string' && payload.trim()) {
        return payload
      }

      if (isJsonRecord(payload)) {
        const directMessage = payload.message
        if (typeof directMessage === 'string' && directMessage.trim()) {
          return directMessage
        }

        const titleMessage = payload.title
        if (typeof titleMessage === 'string' && titleMessage.trim()) {
          return titleMessage
        }

        const errorMessage = payload.error
        if (typeof errorMessage === 'string' && errorMessage.trim()) {
          return errorMessage
        }

        const validationMessage = getFirstValidationMessage(payload.errors)
        if (validationMessage) {
          return validationMessage
        }
      }
    } catch {
      return null
    }
  }

  try {
    const responseText = await response.text()
    if (responseText.trim()) {
      return responseText
    }
  } catch {
    return null
  }

  return null
}

async function ensureSuccess(response: Response): Promise<void> {
  if (response.ok) {
    return
  }

  const apiMessage = await readResponseMessage(response)
  const fallbackMessage = response.statusText || 'Unexpected API error.'
  throw new ApiRequestError(apiMessage ?? fallbackMessage, response.status)
}

function mapUserSummaryToAuthUser(summary: UserSummaryResponse): AuthUser {
  const fullName = summary.fullName?.trim() ?? ''
  const firstName = summary.firstName?.trim() ?? ''
  const lastName = summary.lastName?.trim() ?? ''
  const fallbackName = `${firstName} ${lastName}`.trim()
  const email = summary.email?.trim() ?? ''
  const role = summary.role?.trim() ?? ''

  return {
    id: summary.id || null,
    name: fullName || fallbackName || email || 'User',
    email,
    role,
  }
}

async function requestCurrentUser(): Promise<CurrentUserRequestResult> {
  const csrfToken = getCsrfCookieToken()

  if (!csrfToken) {
    return {
      status: 'unauthorized',
      user: null,
    }
  }

  const response = await apiFetch('/api/users/me/summary', {
    method: 'GET',
    headers: {
      'X-CSRF-Token': csrfToken,
    },
  })

  if (response.status === 401) {
    return {
      status: 'unauthorized',
      user: null,
    }
  }

  await ensureSuccess(response)

  const summaryPayload: unknown = await response.json()
  if (!isJsonRecord(summaryPayload)) {
    return {
      status: 'ok',
      user: null,
    }
  }

  const id = asTrimmedString(summaryPayload.id)

  const summary: UserSummaryResponse = {
    id,
    fullName: asTrimmedString(summaryPayload.fullName),
    role: asTrimmedString(summaryPayload.role),
    department: asTrimmedString(summaryPayload.department),
    status: asTrimmedString(summaryPayload.status),
    email: asTrimmedString(summaryPayload.email),
    firstName: asTrimmedString(summaryPayload.firstName),
    lastName: asTrimmedString(summaryPayload.lastName),
  }

  return {
    status: 'ok',
    user: mapUserSummaryToAuthUser(summary),
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const result = await requestCurrentUser()

  return result.status === 'ok' ? result.user : null
}

async function executeRefreshRequest(): Promise<boolean> {
  const response = await apiFetch('/auth/refresh', {
    method: 'POST',
  })

  if (response.status === 401) {
    return false
  }

  await ensureSuccess(response)
  return true
}

export async function refreshAuthSession(): Promise<boolean> {
  if (!getCsrfCookieToken()) {
    return false
  }

  // Evite les appels concurrents a /auth/refresh quand plusieurs requetes echouent en meme temps.
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    try {
      return await executeRefreshRequest()
    } catch (error) {
      console.error('Failed to refresh auth session:', error)
      return false
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

async function runAuthInitialization(): Promise<AuthUser | null> {
  // Etape 1 : en absence de cookie CSRF, on considere l utilisateur deconnecte
  // et on evite tout appel reseau (/api/users/me/summary et /auth/refresh).
  const csrfToken = getCsrfCookieToken()

  if (!csrfToken) {
    return null
  }

  try {
    // Etape 2 : tentative de lecture du profil courant via /api/users/me/summary.
    const meResult = await requestCurrentUser()

    if (meResult.status === 'ok') {
      return meResult.user
    }

    // Etape 3 : si /api/users/me/summary renvoie 401, on tente un refresh unique.
    const didRefreshSucceed = await refreshAuthSession()
    if (!didRefreshSucceed) {
      return null
    }

    // Etape 4 : refresh reussi, on rejoue une seule fois /api/users/me/summary.
    const retryMeResult = await requestCurrentUser()
    return retryMeResult.status === 'ok' ? retryMeResult.user : null
  } catch (error) {
    console.error('Failed to initialize current user:', error)
    return null
  }
}

export function initializeCurrentUser(): Promise<AuthUser | null> {
  // Garantit un bootstrap unique meme si le provider est monte plusieurs fois (ex: React StrictMode).
  if (authInitializationPromise) {
    return authInitializationPromise
  }

  authInitializationPromise = runAuthInitialization().finally(() => {
    authInitializationPromise = null
  })

  return authInitializationPromise
}

export async function loginWithPassword(email: string, password: string, rememberMe: boolean = false): Promise<AuthUser> {
  const response = await apiFetch('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password, rememberMe }),
  })

  await ensureSuccess(response)

  const user = await getCurrentUser()
  if (!user) {
    throw new Error('AUTH_PROFILE_UNAVAILABLE')
  }

  return user
}

export async function signupWithPassword(payload: SignupPayload): Promise<AuthUser> {
  const response = await apiFetch('/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  await ensureSuccess(response)

  const user = await getCurrentUser()
  if (!user) {
    throw new Error('AUTH_PROFILE_UNAVAILABLE')
  }

  return user
}

export async function logoutCurrentUser(): Promise<void> {
  const csrfToken = getCsrfCookieToken()
  const headers = new Headers()

  if (csrfToken) {
    headers.set('X-CSRF-Token', csrfToken)
  }

  const response = await apiFetch('/auth/logout', {
    method: 'POST',
    headers,
  })

  await ensureSuccess(response)
}
import { getCsrfCookieToken } from '../../lib/auth'
import { apiFetch } from './apiClient'

export interface AuthUser {
  id: string | null
  name: string
  email: string
  role: string
}

interface AuthClaim {
  type: string
  value: string
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

function readFirstClaim(claims: AuthClaim[], claimTypes: string[]): string | null {
  for (const claimType of claimTypes) {
    const claim = claims.find((item) => item.type === claimType)
    if (claim?.value) {
      return claim.value
    }
  }

  return null
}

function mapClaimsToUser(claims: AuthClaim[]): AuthUser | null {
  const email = readFirstClaim(claims, [
    'email',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  ])

  const name = readFirstClaim(claims, [
    'name',
    'username',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
  ])

  const role = readFirstClaim(claims, [
    'role',
    'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
  ])

  const id = readFirstClaim(claims, [
    'userId',
    'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
  ])

  if (!email && !name) {
    return null
  }

  return {
    id,
    name: name ?? email ?? '',
    email: email ?? '',
    role: role ?? '',
  }
}

async function requestCurrentUser(): Promise<CurrentUserRequestResult> {
  const response = await apiFetch('/auth/me', {
    method: 'GET',
  })

  if (response.status === 401) {
    return {
      status: 'unauthorized',
      user: null,
    }
  }

  await ensureSuccess(response)

  const claimsPayload: unknown = await response.json()
  if (!Array.isArray(claimsPayload)) {
    return {
      status: 'ok',
      user: null,
    }
  }

  const claims = claimsPayload.filter((claim): claim is AuthClaim => {
    if (!isJsonRecord(claim)) {
      return false
    }

    return typeof claim.type === 'string' && typeof claim.value === 'string'
  })

  return {
    status: 'ok',
    user: mapClaimsToUser(claims),
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
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    try {
      return await executeRefreshRequest()
    } catch {
      return false
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

async function runAuthInitialization(): Promise<AuthUser | null> {
  const csrfToken = getCsrfCookieToken()

  if (!csrfToken) {
    return null
  }

  try {
    const meResult = await requestCurrentUser()

    if (meResult.status === 'ok') {
      return meResult.user
    }

    const didRefreshSucceed = await refreshAuthSession()
    if (!didRefreshSucceed) {
      return null
    }

    const retryMeResult = await requestCurrentUser()
    return retryMeResult.status === 'ok' ? retryMeResult.user : null
  } catch {
    return null
  }
}

export function initializeCurrentUser(): Promise<AuthUser | null> {
  if (authInitializationPromise) {
    return authInitializationPromise
  }

  authInitializationPromise = runAuthInitialization().finally(() => {
    authInitializationPromise = null
  })

  return authInitializationPromise
}

export async function loginWithPassword(email: string, password: string): Promise<AuthUser> {
  const response = await apiFetch('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
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
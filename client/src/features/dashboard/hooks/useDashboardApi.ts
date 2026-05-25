import { useCallback, useMemo } from 'react'
import { apiFetch } from '../../../lib/apiClient'
import { getCsrfCookieToken } from '../../../lib/auth'

type JsonRecord = Record<string, unknown>

class DashboardApiError extends Error {
  status: number
  fieldErrors: Record<string, string>
  code?: string
  blockers?: Record<string, number>

  constructor(
    message: string,
    status: number,
    fieldErrors: Record<string, string> = {},
    code?: string,
    blockers?: Record<string, number>,
  ) {
    super(message)
    this.name = 'DashboardApiError'
    this.status = status
    this.fieldErrors = fieldErrors
    this.code = code
    this.blockers = blockers
  }
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null
}

function parseFieldErrors(errors: JsonRecord): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [field, messages] of Object.entries(errors)) {
    if (Array.isArray(messages)) {
      const firstMessage = messages.find((item): item is string => typeof item === 'string')
      if (firstMessage) {
        result[field] = firstMessage
      }
    }
  }
  return result
}

function parseFlatFieldErrors(payload: unknown): Record<string, string> {
  const result: Record<string, string> = {}
  if (!isJsonRecord(payload)) {
    return result
  }
  for (const [key, value] of Object.entries(payload)) {
    if (key === 'message' || key === 'title' || key === 'error' || key === 'detail' || key === 'errors' || key === 'code' || key === 'blockers') {
      continue
    }
    if (typeof value === 'string' && value.trim()) {
      result[key] = value.trim()
    }
  }
  return result
}

function parseBlockers(payload: JsonRecord): Record<string, number> | null {
  const blockers = payload.blockers
  if (!isJsonRecord(blockers)) {
    return null
  }

  const parsed: Record<string, number> = {}
  for (const [key, value] of Object.entries(blockers)) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      parsed[key] = value
    }
  }

  return Object.keys(parsed).length > 0 ? parsed : null
}

async function ensureSuccess(response: Response): Promise<void> {
  if (response.ok) {
    return
  }

  const contentType = response.headers.get('content-type') ?? ''
  let fieldErrors: Record<string, string> = {}
  let apiMessage: string | null = null
  let apiCode: string | null = null
  let apiBlockers: Record<string, number> | null = null

  if (contentType.includes('application/json') || contentType.includes('text/json') || contentType.includes('+json')) {
    try {
      const payload: unknown = await response.json()

      if (typeof payload === 'string' && payload.trim()) {
        apiMessage = payload
      } else if (isJsonRecord(payload)) {
        const directCode = payload.code
        if (typeof directCode === 'string' && directCode.trim()) {
          apiCode = directCode.trim()
        }

        apiBlockers = parseBlockers(payload)

        const directMessage = payload.message
        if (typeof directMessage === 'string' && directMessage.trim()) {
          apiMessage = directMessage
        }

        const titleMessage = payload.title
        if (typeof titleMessage === 'string' && titleMessage.trim() && !apiMessage) {
          apiMessage = titleMessage
        }

        const errorMessage = payload.error
        if (typeof errorMessage === 'string' && errorMessage.trim() && !apiMessage) {
          apiMessage = errorMessage
        }

        const detailMessage = payload.detail
        if (typeof detailMessage === 'string' && detailMessage.trim() && !apiMessage) {
          apiMessage = detailMessage
        }

        const errors = payload.errors
        if (isJsonRecord(errors)) {
          fieldErrors = parseFieldErrors(errors)
        } else {
          const flatErrors = parseFlatFieldErrors(payload)
          if (Object.keys(flatErrors).length > 0) {
            fieldErrors = flatErrors
          }
        }
      }
    } catch {
      // Continue to fallback
    }
  }

  if (!apiMessage) {
    try {
      const responseText = await response.text()
      if (responseText.trim()) {
        apiMessage = responseText
      }
    } catch {
      // Continue to fallback
    }
  }

  const fallbackMessage = response.statusText || 'Unexpected API error.'
  throw new DashboardApiError(apiMessage ?? fallbackMessage, response.status, fieldErrors, apiCode ?? undefined, apiBlockers ?? undefined)
}

export function isDashboardApiError(error: unknown): error is DashboardApiError {
  return error instanceof DashboardApiError
}

async function parseJsonBody<T>(response: Response): Promise<T> {
  if (response.status === 204 || response.status === 205) {
    return undefined as T
  }

  const contentLength = response.headers.get('content-length')
  if (contentLength === '0') {
    return undefined as T
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!(contentType.includes('application/json') || contentType.includes('text/json') || contentType.includes('+json'))) {
    return undefined as T
  }

  const rawBody = await response.text()
  if (!rawBody.trim()) {
    return undefined as T
  }

  return JSON.parse(rawBody) as T
}

/**
 * Hook pour les appels API du dashboard.
 * Encapsule les méthodes GET, POST, PATCH avec gestion du CSRF.
 */
export function useDashboardApi() {
  const get = useCallback(async <T>(path: string): Promise<T> => {
    const csrfToken = getCsrfCookieToken()
    const headers: Record<string, string> = {}
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken
    }

    const response = await apiFetch(path, {
      method: 'GET',
      headers,
    })

    await ensureSuccess(response)

    return parseJsonBody<T>(response)
  }, [])

  const post = useCallback(async <T>(path: string, body: unknown): Promise<T> => {
    const csrfToken = getCsrfCookieToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken
    }

    const response = await apiFetch(path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    await ensureSuccess(response)

    return parseJsonBody<T>(response)
  }, [])

  const patch = useCallback(async <T>(path: string, body: unknown): Promise<T> => {
    const csrfToken = getCsrfCookieToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken
    }

    const response = await apiFetch(path, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    })

    await ensureSuccess(response)

    return parseJsonBody<T>(response)
  }, [])

  const put = useCallback(async <T>(path: string, body: unknown): Promise<T> => {
    const csrfToken = getCsrfCookieToken()
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken
    }

    const response = await apiFetch(path, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    })

    await ensureSuccess(response)

    return parseJsonBody<T>(response)
  }, [])

  const del = useCallback(async (path: string): Promise<void> => {
    const csrfToken = getCsrfCookieToken()
    const headers: Record<string, string> = {}
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken
    }

    const response = await apiFetch(path, {
      method: 'DELETE',
      headers,
    })

    await ensureSuccess(response)
  }, [])

  const postFormData = useCallback(async <T>(path: string, formData: FormData): Promise<T> => {
    const csrfToken = getCsrfCookieToken()
    const headers: Record<string, string> = {}
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken
    }

    const response = await apiFetch(path, {
      method: 'POST',
      headers,
      body: formData,
      omitJsonAcceptHeader: true,
    })

    await ensureSuccess(response)

    return parseJsonBody<T>(response)
  }, [])

return useMemo(
  () => ({ get, post, patch, put, del, postFormData }),
  [get, post, patch, put, del, postFormData]
)
}

export { DashboardApiError }
export type { JsonRecord }

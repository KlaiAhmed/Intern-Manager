import { useCallback, useMemo } from 'react'
import { apiFetch } from '../../../shared/api/apiClient'
import { getCsrfCookieToken } from '../../../lib/auth'

type JsonRecord = Record<string, unknown>

class DashboardApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'DashboardApiError'
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

  if (contentType.includes('application/json') || contentType.includes('text/json') || contentType.includes('+json')) {
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

        const detailMessage = payload.detail
        if (typeof detailMessage === 'string' && detailMessage.trim()) {
          return detailMessage
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
  throw new DashboardApiError(apiMessage ?? fallbackMessage, response.status)
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
    () => ({ get, post, patch, del, postFormData }),
    [get, post, patch, del, postFormData]
  )
}

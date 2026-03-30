import { useCallback } from 'react'
import { apiFetch } from '../../../shared/api/apiClient'
import { getCsrfCookieToken } from '../../../lib/auth'

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

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    return response.json() as Promise<T>
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

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    return response.json() as Promise<T>
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

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    return response.json() as Promise<T>
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

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
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

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    return response.json() as Promise<T>
  }, [])

  return { get, post, patch, del, postFormData }
}

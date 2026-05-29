import { buildApiUrl } from './apiClient'
import { getCsrfCookieToken } from './auth'

export interface UploadProgress {
  loaded: number
  total: number | null
  percent: number | null
}

export interface UploadWithProgressOptions {
  path: string
  formData: FormData
  method?: 'POST' | 'PUT' | 'PATCH'
  headers?: HeadersInit
  onProgress?: (progress: UploadProgress) => void
  signal?: AbortSignal
  withCredentials?: boolean
}

export class UploadError extends Error {
  status: number
  response: unknown

  constructor(message: string, status: number, response: unknown) {
    super(message)
    this.name = 'UploadError'
    this.status = status
    this.response = response
  }
}

function buildUploadHeaders(headersInit: HeadersInit | undefined): Headers {
  const headers = new Headers(headersInit)

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }

  const csrfToken = getCsrfCookieToken()
  if (csrfToken) {
    headers.set('X-CSRF-Token', csrfToken)
  }

  return headers
}

function parseResponseBody(xhr: XMLHttpRequest): unknown {
  const responseText = xhr.responseText?.trim() ?? ''

  if (!responseText) {
    return undefined
  }

  const contentType = xhr.getResponseHeader('content-type') ?? ''
  if (contentType.includes('application/json') || contentType.includes('text/json') || contentType.includes('+json')) {
    try {
      return JSON.parse(responseText) as unknown
    } catch {
      return responseText
    }
  }

  return responseText
}

function getPayloadMessage(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) {
    return typeof payload === 'string' && payload.trim() ? payload.trim() : null
  }

  const record = payload as Record<string, unknown>
  for (const key of ['message', 'detail', 'title', 'error']) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

export function uploadWithProgress<TResponse = unknown>({
  path,
  formData,
  method = 'POST',
  headers,
  onProgress,
  signal,
  withCredentials = true,
}: UploadWithProgressOptions): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let isSettled = false

    const rejectOnce = (error: Error) => {
      if (isSettled) {
        return
      }

      isSettled = true
      signal?.removeEventListener('abort', abortUpload)
      reject(error)
    }

    const resolveOnce = (value: TResponse) => {
      if (isSettled) {
        return
      }

      isSettled = true
      signal?.removeEventListener('abort', abortUpload)
      resolve(value)
    }

    function abortUpload() {
      xhr.abort()
    }

    if (signal?.aborted) {
      rejectOnce(new Error('Upload aborted.'))
      return
    }

    xhr.open(method, buildApiUrl(path))
    xhr.withCredentials = withCredentials

    buildUploadHeaders(headers).forEach((value, key) => {
      xhr.setRequestHeader(key, value)
    })

    xhr.upload.onprogress = (event) => {
      if (!onProgress) {
        return
      }

      if (!event.lengthComputable || event.total <= 0) {
        onProgress({
          loaded: event.loaded,
          total: null,
          percent: null,
        })
        return
      }

      onProgress({
        loaded: event.loaded,
        total: event.total,
        percent: Math.min(100, Math.round((event.loaded / event.total) * 100)),
      })
    }

    xhr.onload = () => {
      const payload = parseResponseBody(xhr)

      if (xhr.status >= 200 && xhr.status < 300) {
        resolveOnce(payload as TResponse)
        return
      }

      const fallbackMessage = xhr.statusText || `Upload failed with status ${xhr.status}.`
      const message = getPayloadMessage(payload) ?? fallbackMessage
      rejectOnce(new UploadError(message, xhr.status, payload))
    }

    xhr.onerror = () => {
      rejectOnce(new Error('Network error while uploading file.'))
    }

    xhr.onabort = () => {
      rejectOnce(new Error('Upload aborted.'))
    }

    signal?.addEventListener('abort', abortUpload, { once: true })
    xhr.send(formData)
  })
}

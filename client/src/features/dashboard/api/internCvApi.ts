import { apiBaseUrl } from '../../../lib/apiClient'
import { getCsrfCookieToken } from '../../../lib/auth'
import type { CvUploadResponse } from '../types/internDashboard'

export function uploadInternCvWithProgress(
  internId: string,
  file: File,
  onProgress: (value: number) => void,
): Promise<CvUploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()
    formData.append('file', file)

    xhr.open('POST', `${apiBaseUrl}/api/interns/${internId}/upload-cv`)
    xhr.withCredentials = true
    xhr.setRequestHeader('Accept', 'application/json')

    const csrfToken = getCsrfCookieToken()
    if (csrfToken) {
      xhr.setRequestHeader('X-CSRF-Token', csrfToken)
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
      }
    }

    xhr.onload = () => {
      const responseText = xhr.responseText?.trim() ?? ''
      let payload: Record<string, unknown> = {}

      if (responseText) {
        try {
          payload = JSON.parse(responseText) as Record<string, unknown>
        } catch {
          payload = {}
        }
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload as CvUploadResponse)
        return
      }

      const apiMessage = typeof payload.message === 'string' && payload.message.trim().length > 0
        ? payload.message
        : xhr.statusText

      reject(new Error(apiMessage || 'CV upload failed.'))
    }

    xhr.onerror = () => {
      reject(new Error('Network error while uploading CV.'))
    }

    xhr.send(formData)
  })
}

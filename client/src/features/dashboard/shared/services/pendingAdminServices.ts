import type {
  ArchiveHistoryRecord,
  BiAccessMatrix,
  EmailTemplate,
  EmailTemplateFormState,
  NotificationRule,
} from '../types/operations'
import { getCsrfCookieToken } from '../../../../lib/auth'
import { apiFetch } from '../../../../lib/apiClient'

export class PendingEndpointError extends Error {
  status: number
  endpoint: string

  constructor(endpoint: string) {
    super(`501 Not Implemented - endpoint pending: ${endpoint}`)
    this.name = 'PendingEndpointError'
    this.status = 501
    this.endpoint = endpoint
  }
}

function buildHeaders(contentType: 'json' | 'none' = 'none'): Headers {
  const headers = new Headers()

  if (contentType === 'json') {
    headers.set('Content-Type', 'application/json')
  }

  const csrfToken = getCsrfCookieToken()
  if (csrfToken) {
    headers.set('X-CSRF-Token', csrfToken)
  }

  return headers
}

function readErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const record = payload as Record<string, unknown>

  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message
  }

  if (typeof record.title === 'string' && record.title.trim()) {
    return record.title
  }

  return null
}

async function ensureSuccess(response: Response): Promise<void> {
  if (response.ok) {
    return
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('json')) {
    try {
      const payload = await response.json()
      const message = readErrorMessage(payload)
      throw new Error(message ?? response.statusText)
    } catch {
      throw new Error(response.statusText || `Request failed with status ${response.status}`)
    }
  }

  throw new Error(response.statusText || `Request failed with status ${response.status}`)
}

async function parseJson<T>(response: Response): Promise<T> {
  if (response.status === 204 || response.status === 205) {
    return undefined as T
  }

  const contentLength = response.headers.get('content-length')
  if (contentLength === '0') {
    return undefined as T
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('json')) {
    return undefined as T
  }

  const raw = await response.text()
  if (!raw.trim()) {
    return undefined as T
  }

  return JSON.parse(raw) as T
}

export const pendingAdminServices = {
  async listNotificationRules(): Promise<NotificationRule[]> {
    const response = await apiFetch('/api/admin/notifications/rules', {
      method: 'GET',
      headers: buildHeaders(),
    })

    await ensureSuccess(response)
    return parseJson<NotificationRule[]>(response)
  },

  async updateNotificationRule(ruleId: string, enabled: boolean): Promise<void> {
    const response = await apiFetch(`/api/admin/notifications/rules/${ruleId}`, {
      method: 'PATCH',
      headers: buildHeaders('json'),
      body: JSON.stringify({ enabled }),
    })

    await ensureSuccess(response)
  },

  async listEmailTemplates(): Promise<EmailTemplate[]> {
    const response = await apiFetch('/api/admin/email-templates', {
      method: 'GET',
      headers: buildHeaders(),
    })

    await ensureSuccess(response)
    return parseJson<EmailTemplate[]>(response)
  },

  async saveEmailTemplate(templateId: string, template: EmailTemplateFormState): Promise<void> {
    const response = await apiFetch(`/api/admin/email-templates/${templateId}`, {
      method: 'PATCH',
      headers: buildHeaders('json'),
      body: JSON.stringify({
        name: template.name,
        subject: template.subject,
        body: template.body,
      }),
    })

    await ensureSuccess(response)
  },

  async triggerArchive(): Promise<void> {
    const response = await apiFetch('/api/admin/archive', {
      method: 'POST',
      headers: buildHeaders(),
    })

    await ensureSuccess(response)
  },

  async listArchiveHistory(): Promise<ArchiveHistoryRecord[]> {
    const response = await apiFetch('/api/admin/archive/history', {
      method: 'GET',
      headers: buildHeaders(),
    })

    await ensureSuccess(response)
    return parseJson<ArchiveHistoryRecord[]>(response)
  },

  async listBiAccessMatrix(): Promise<BiAccessMatrix[]> {
    const response = await apiFetch('/api/admin/bi-access', {
      method: 'GET',
      headers: buildHeaders(),
    })

    await ensureSuccess(response)
    return parseJson<BiAccessMatrix[]>(response)
  },

  async saveBiAccessMatrix(matrix: BiAccessMatrix[]): Promise<void> {
    const response = await apiFetch('/api/admin/bi-access', {
      method: 'PATCH',
      headers: buildHeaders('json'),
      body: JSON.stringify(matrix),
    })

    await ensureSuccess(response)
  },
}

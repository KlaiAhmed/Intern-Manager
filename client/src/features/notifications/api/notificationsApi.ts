import { apiFetch } from '../../../lib/apiClient'
import { getCsrfCookieToken } from '../../../lib/auth'
import type {
  DashboardNotificationRole,
  Notification,
  NotificationListResponse,
} from '../types/notification'

const defaultLimit = 20

const notificationEndpointByRole: Record<DashboardNotificationRole, string> = {
  super_admin: '/api/notifications',
  admin: '/api/notifications',
  manager: '/api/notifications',
  supervisor: '/api/notifications',
  intern: '/api/intern/me/notifications',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return ''
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asBoolean(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false
}

function resolveNotificationTitle(type: string): string {
  const normalizedType = type.trim().toLowerCase().replace(/[_\s]+/g, '')

  if (normalizedType.includes('evaluation')) {
    return 'Evaluation update'
  }

  if (normalizedType.includes('journal')) {
    return 'Journal update'
  }

  if (normalizedType.includes('featureflag')) {
    return 'Dashboard access updated'
  }

  return 'Notification'
}

function toNotification(value: unknown): Notification | null {
  if (!isRecord(value)) {
    return null
  }

  const id = asString(value.id ?? value.notificationId)
  if (!id) {
    return null
  }

  const type = asString(value.type)
  const title = asString(value.title) || resolveNotificationTitle(type)
  const relatedEntity = asNullableString(value.relatedEntity ?? value.relatedEntityId)
  const message = asString(value.message)
  const createdAt = asString(value.createdAt)

  return {
    id,
    type,
    title,
    message,
    relatedEntity,
    isRead: asBoolean(value.isRead),
    createdAt,
    readAt: asNullableString(value.readAt),
  }
}

export function parseNotificationListResponse(payload: unknown): NotificationListResponse {
  if (!isRecord(payload)) {
    return {
      data: [],
      total: 0,
      page: 1,
      limit: defaultLimit,
    }
  }

  const data = Array.isArray(payload.data)
    ? payload.data
      .map(toNotification)
      .filter((notification): notification is Notification => notification !== null)
    : []

  const total = typeof payload.total === 'number' ? payload.total : data.length
  const page = typeof payload.page === 'number' ? payload.page : 1
  const limit = typeof payload.limit === 'number'
    ? payload.limit
    : typeof payload.pageSize === 'number'
      ? payload.pageSize
      : defaultLimit

  return {
    data,
    total,
    page,
    limit,
  }
}

function buildHeaders(): Record<string, string> {
  const csrfToken = getCsrfCookieToken()

  if (!csrfToken) {
    return {}
  }

  return {
    'X-CSRF-Token': csrfToken,
  }
}

export function resolveNotificationsEndpoint(role: DashboardNotificationRole | null): string | null {
  if (!role) {
    return null
  }

  return notificationEndpointByRole[role]
}

export async function fetchNotificationsByRole(
  role: DashboardNotificationRole,
  limit: number = defaultLimit,
): Promise<NotificationListResponse> {
  const endpoint = resolveNotificationsEndpoint(role)

  if (!endpoint) {
    return {
      data: [],
      total: 0,
      page: 1,
      limit,
    }
  }

  const query = role === 'intern'
    ? `?page=1&pageSize=${limit}`
    : `?page=1&limit=${limit}`

  const response = await apiFetch(`${endpoint}${query}`, {
    method: 'GET',
    headers: buildHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Notifications request failed with status ${response.status}`)
  }

  const payload: unknown = await response.json()
  return parseNotificationListResponse(payload)
}

export async function markNotificationRead(role: DashboardNotificationRole, notificationId: string): Promise<void> {
  const endpoint = role === 'intern'
    ? `/api/intern/me/notifications/${encodeURIComponent(notificationId)}/read`
    : `/api/notifications/${encodeURIComponent(notificationId)}/read`

  await apiFetch(endpoint, {
    method: 'PATCH',
    headers: buildHeaders(),
  })
}

export async function markAllNotificationsRead(role: DashboardNotificationRole): Promise<void> {
  if (role !== 'intern') {
    return
  }

  await apiFetch('/api/intern/me/notifications/read-all', {
    method: 'PATCH',
    headers: buildHeaders(),
  })
}

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
  intern: '/api/notifications',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asBoolean(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false
}

function toNotification(value: unknown): Notification | null {
  if (!isRecord(value)) {
    return null
  }

  const id = asString(value.id)
  if (!id) {
    return null
  }

  return {
    id,
    type: asString(value.type),
    title: asString(value.title),
    message: asString(value.message),
    relatedEntity: asNullableString(value.relatedEntity),
    isRead: asBoolean(value.isRead),
    createdAt: asString(value.createdAt),
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
  const limit = typeof payload.limit === 'number' ? payload.limit : defaultLimit

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

  const response = await apiFetch(`${endpoint}?page=1&limit=${limit}`, {
    method: 'GET',
    headers: buildHeaders(),
  })

  if (!response.ok) {
    throw new Error(`Notifications request failed with status ${response.status}`)
  }

  const payload: unknown = await response.json()
  return parseNotificationListResponse(payload)
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await apiFetch(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PATCH',
    headers: buildHeaders(),
  })
}

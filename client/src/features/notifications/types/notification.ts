export type DashboardNotificationRole = 'super_admin' | 'admin' | 'manager' | 'supervisor' | 'intern'

export interface Notification {
  id: string
  type: string
  title: string
  message: string
  relatedEntity: string | null
  isRead: boolean
  createdAt: string
  readAt: string | null
}

export interface NotificationListResponse {
  data: Notification[] | null
  total: number
  page: number
  limit: number
}

export interface NotificationReadResponse {
  id: string
  isRead: boolean
  readAt: string | null
}

export function normalizeDashboardNotificationRole(rawRole: string | null | undefined): DashboardNotificationRole | null {
  if (!rawRole) {
    return null
  }

  const normalized = rawRole.trim().toLowerCase().replace(/[\s-]/g, '_')

  switch (normalized) {
    case 'superadmin':
    case 'super_admin':
      return 'super_admin'
    case 'admin':
      return 'admin'
    case 'manager':
      return 'manager'
    case 'supervisor':
      return 'supervisor'
    case 'intern':
      return 'intern'
    default:
      return null
  }
}

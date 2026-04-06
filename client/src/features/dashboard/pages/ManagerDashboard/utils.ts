import type { Activity, InternshipRecord, UserRecord } from './types'

export function asNonEmptyString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function resolveUserName(user: UserRecord): string {
  const name = asNonEmptyString(user.name)
  if (name) return name

  const firstName = asNonEmptyString(user.firstName)
  const lastName = asNonEmptyString(user.lastName)
  const fullName = `${firstName} ${lastName}`.trim()
  if (fullName) return fullName

  return asNonEmptyString(user.email) || 'Unknown'
}

export function readNumericValue(payload: unknown): number {
  if (typeof payload === 'number') return payload
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>
    for (const key of ['count', 'value', 'total']) {
      const candidate = record[key]
      if (typeof candidate === 'number') return candidate
    }
  }
  return 0
}

export function normalizeInternStatus(statusValue: string): 'active' | 'completed' | 'pending' {
  const status = statusValue.trim().toLowerCase()
  if (status === 'completed' || status === 'done' || status === 'finished') return 'completed'
  if (status === 'pending' || status === 'awaiting' || status === 'not_started') return 'pending'
  return 'active'
}

export function estimateProgress(startDate?: string, endDate?: string, statusValue?: string): number {
  if (normalizeInternStatus(statusValue ?? '') === 'completed') return 100

  const start = startDate ? Date.parse(startDate) : Number.NaN
  const end = endDate ? Date.parse(endDate) : Number.NaN
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0

  const now = Date.now()
  if (now <= start) return 0
  if (now >= end) return 100

  return Math.max(0, Math.min(100, Math.round(((now - start) / (end - start)) * 100)))
}

export function inferActivityType(action: string): Activity['type'] {
  const normalized = action.toLowerCase()
  if (normalized.includes('deliverable') || normalized.includes('submit')) return 'submission'
  if (normalized.includes('evaluation')) return 'evaluation'
  if (normalized.includes('mission')) return 'mission_created'
  return 'meeting'
}

export function computeCompletionPercentage(internships: InternshipRecord[]): number {
  const completedInternships = internships.filter((item) => asNonEmptyString(item.status).toLowerCase() === 'completed').length
  return internships.length > 0 ? Math.round((completedInternships / internships.length) * 100) : 0
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((segment) => segment[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function formatActivityDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function getActivityIcon(type: Activity['type']): string {
  switch (type) {
    case 'submission':
      return '↑'
    case 'evaluation':
      return '✓'
    case 'mission_created':
      return '⌘'
    case 'meeting':
      return '○'
    default:
      return '•'
  }
}

import {
  differenceInCalendarDays,
  format,
  isBefore,
  isToday,
  isTomorrow,
  parseISO,
  startOfDay,
} from 'date-fns'

import type {
  DeliverableStatus,
  StatusTone,
  SupervisorTask,
  TaskStatus,
} from '../../types/supervisorDashboard'

const TITLE_PREFIX = 'TITLE:'
const URL_PREFIX = 'URL:'

export function getDeliverableStatusTone(status: DeliverableStatus): StatusTone {
  switch (status) {
    case 'draft':
      return 'neutral'
    case 'in_progress':
      return 'info'
    case 'awaiting_review':
      return 'warning'
    case 'approved':
      return 'success'
    case 'changes_requested':
      return 'danger'
    case 'cancelled':
      return 'neutral'
  }
}

export function getTaskStatusTone(status: TaskStatus): StatusTone {
  switch (status) {
    case 'todo':
      return 'neutral'
    case 'in_progress':
      return 'info'
    case 'done':
      return 'success'
    case 'reopened':
      return 'warning'
    case 'cancelled':
      return 'neutral'
  }
}

export function getMeetingDateLabel(date: string): string {
  const parsed = parseISO(date)

  if (isToday(parsed)) {
    return 'Today'
  }

  if (isTomorrow(parsed)) {
    return 'Tomorrow'
  }

  return format(parsed, 'MMMM d, yyyy')
}

export function parseMeetingNotes(rawNotes: string): {
  title: string
  meetingUrl: string | undefined
  body: string
} {
  const lines = rawNotes.split('\n')
  let title = ''
  let meetingUrl: string | undefined
  let bodyStartIndex = 0

  const firstLine = lines[0]
  if (firstLine !== undefined && firstLine.startsWith(TITLE_PREFIX)) {
    title = firstLine.slice(TITLE_PREFIX.length)
    bodyStartIndex = 1
  }

  const urlLineIndex = bodyStartIndex
  const urlLine = lines[urlLineIndex]
  if (urlLine !== undefined && urlLine.startsWith(URL_PREFIX)) {
    const url = urlLine.slice(URL_PREFIX.length)
    meetingUrl = url || undefined
    bodyStartIndex = urlLineIndex + 1
  }

  const body = lines.slice(bodyStartIndex).join('\n')

  return { title, meetingUrl, body: body.trim() }
}

export function buildMeetingNotes(
  title: string,
  meetingUrl: string | undefined,
  body: string,
): string {
  let result = `${TITLE_PREFIX}${title}\n`

  if (meetingUrl) {
    result += `${URL_PREFIX}${meetingUrl}\n`
  }

  result += body
  return result
}

export function getTaskPriority(dueDate: string | undefined): 'high' | 'medium' | 'low' {
  if (!dueDate) {
    return 'low'
  }

  const daysUntil = differenceInCalendarDays(parseISO(dueDate), new Date())

  if (daysUntil <= 3) {
    return 'high'
  }

  if (daysUntil <= 7) {
    return 'medium'
  }

  return 'low'
}

export function isTaskOverdue(task: SupervisorTask): boolean {
  if (!task.dueDate) {
    return false
  }

  if (task.status === 'done' || task.status === 'cancelled') {
    return false
  }

  return isBefore(startOfDay(parseISO(task.dueDate)), startOfDay(new Date()))
}

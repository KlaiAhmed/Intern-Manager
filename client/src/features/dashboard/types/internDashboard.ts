import type { TranslationKey } from '../../../locales/I18nContext'

export type TranslateFn = (key: TranslationKey) => string

export interface Internship {
  id: string
  missionTitle: string
  supervisorName: string
  department: string
  startDate: string
  endDate: string
  status: string
  progress: number
}

export interface Task {
  id: string
  title: string
  dueDate: string
  completed: boolean
  priority?: 'high' | 'medium' | 'low'
}

export interface Deliverable {
  id: string
  title: string
  dueDate: string
  status: 'not_submitted' | 'submitted' | 'accepted' | 'rejected'
  version: number
  supervisorComment?: string
  progress: number
}

export interface JournalEntry {
  id: string
  content: string
  createdAt: string
}

export interface Evaluation {
  id: string
  type: 'mid_term' | 'end_of_internship'
  scores: {
    technical: number
    autonomy: number
    communication: number
    deadlineRespect: number
    deliverableQuality: number
  }
  comments: string
  date: string
}

export interface Meeting {
  id: string
  date: string
  supervisorName: string
  notes: string
}

export type InternLifecycleStatus = 'INCOMPLETE' | 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED'

export interface InternStatusResponse {
  id: string
  status: InternLifecycleStatus
}

export interface NotificationItem {
  id: string
  type: string
  message: string
  title: string
}

export interface InternProfileReadOnly {
  school?: string
  specialty?: string
  experience?: string
  cvFileUrl?: string | null
}

export interface CvUploadResponse {
  id?: string
  status?: InternLifecycleStatus
  cvFileUrl?: string
}


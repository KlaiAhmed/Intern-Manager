export interface Intern {
  id: string
  name: string
  missionTitle: string
  progress: number
  lastJournalDate: string | null
  isOverdue: boolean
}

export interface Mission {
  id: string
  title: string
  internName: string | null
  status: string
  deliverablesCount: number
}

export interface Deliverable {
  id: string
  internName: string
  title: string
  submittedDate: string
  fileUrl: string
  version: number
}

export interface Evaluation {
  id: string
  internId?: string
  internName: string
  type: 'mid_term' | 'end_of_internship'
}

export interface Meeting {
  id: string
  internName: string
  date: string
  notes: string
}

export interface Skill {
  id: string
  name: string
}

export interface PendingInternOption {
  id: string
  fullName: string
  status: 'PENDING' | 'INCOMPLETE' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED' | string
}

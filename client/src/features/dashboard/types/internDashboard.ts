import type { TranslationKey } from '../../../locales/I18nContext'

export type TranslateFn = (key: TranslationKey, interpolationValues?: Record<string, string | number>) => string

export type InternDashboardTabId =
  | 'overview'
  | 'deliverables'
  | 'mission'
  | 'journal'
  | 'evaluations'
  | 'meetings'
  | 'profile'

export type InternDashboardTabVisibility = Record<InternDashboardTabId, boolean>

export interface Internship {
  id: string
  missionTitle: string
  supervisorName: string
  coSupervisorName?: string | null
  department: string
  startDate: string | null
  endDate: string | null
  status: string
  verificationStatus?: string
  progress: number
}

export interface Task {
  id: string
  title: string
  dueDate: string | null
  completed: boolean
  priority?: 'high' | 'medium' | 'low'
}

export interface Deliverable {
  id: string
  title: string
  dueDate: string | null
  status: 'not_submitted' | 'submitted' | 'accepted' | 'rejected'
  version: number
  supervisorComment?: string | null
  progress: number
}

export interface DeliverableVersionSubmittedBy {
  id: string
  name: string
  email: string
}

export interface DeliverableVersion {
  id: string
  deliverableId: string
  versionNumber: number
  fileUrl?: string | null
  gitHubUrl?: string | null
  gitHubBranch?: string | null
  message?: string | null
  status: string
  supervisorComment?: string | null
  submittedAt: string
  validatedAt?: string | null
  submittedBy?: DeliverableVersionSubmittedBy | null
}

export interface DeliverableVersionHistory {
  deliverable: {
    id: string
    missionId: string
    title: string
    status: string
    version: number
    progress: number
    dueDate: string | null
    submittedDate?: string | null
    supervisorComment?: string | null
  }
  versions: DeliverableVersion[]
}

export interface JournalEntry {
  id: string
  content: string
  isReviewed?: boolean
  comments?: Array<{
    id: number
    content: string
    createdAt: string
    authorId: string
  }>
  evaluationLinks?: Array<{
    id: number
    criteria: string
    linkedByUserId: string
    createdAt: string
  }>
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
  isReleasedToIntern?: boolean
  releasedAt?: string | null
}

export interface Meeting {
  id: string
  date: string
  supervisorName: string
  notes: string
}

export type InternLifecycleStatus = 'INCOMPLETE' | 'PENDING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED' | 'NOT_APPLICABLE'

export interface InternStatusResponse {
  id: string
  status: InternLifecycleStatus
  accountStatus: 'Active' | 'Archived'
  verificationStatus: InternLifecycleStatus
}

export interface NotificationItem {
  id: string
  type: string
  message: string
  title: string
}

export interface ProfileSkillSummary {
  id: string
  name: string
}

export type InternProfileSkill = string | ProfileSkillSummary

export interface InternProfileReadOnly {
  id: string
  universityId: string | null
  major: string
  currentYearOfStudy: string
  expectedGraduationDate: string | null
  workPreference: string | null
  phoneNumber: string | null
  cvFileUrl: string | null
  status: InternLifecycleStatus
  verificationStatus: InternLifecycleStatus
  startDate: string | null
  endDate: string | null
  skills: InternProfileSkill[]
}

export interface PendingInternProfile extends InternProfileReadOnly {
  universityName: string | null
}

export interface CvUploadResponse {
  status?: InternLifecycleStatus
  verificationStatus?: InternLifecycleStatus
  fileUrl?: string | null
}


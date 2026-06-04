export type DeliverableStatus =
  | 'draft'
  | 'in_progress'
  | 'awaiting_review'
  | 'approved'
  | 'changes_requested'
  | 'cancelled'

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'reopened' | 'cancelled'

// TODO: confirm enum values with backend
export type MissionStatus =
  | 'draft'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'archived'

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export type DrawerMode = 'create' | 'edit' | 'view' | 'approve' | 'reject' | 'verify' | null

export type FeatureFlagEntry = CardConfig
export type MissionCardKey = DashboardCard
export type MissionCardConfig = MissionFeatureFlagConfig

export interface MissionHistoryEntry {
  id: string
  missionId: string
  action?: string
  field: string
  oldValue?: string | null
  newValue?: string | null
  changedByUserId?: string | null
  changedBy: string
  changedAt: string
}

export interface SupervisorMissionInternAssignment {
  internId: string
  internName: string
}

export interface SupervisorMission {
  id: string
  title: string
  description: string
  status: MissionStatus
  internId: string
  internIds?: string[]
  internNames?: string[]
  internAssignments?: SupervisorMissionInternAssignment[]
  supervisorId: string
  coSupervisorId?: string | null
  coSupervisorCanReview: boolean
  coSupervisorCanEval: boolean
  tools: string
  level: string
  skills: string[]
  rawProgress: number
  startDate?: string | null
  endDate?: string | null
  createdAt: string
  updatedAt: string
  rowVersion?: string
  cardConfig?: MissionCardConfig
  history?: MissionHistoryEntry[]
}

export interface SupervisorIntern {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  missionId?: string | null
  missionTitle?: string
  startDate?: string | null
  endDate?: string | null
  status?: string
  verificationStatus?: string
}

export interface InternWithProgress extends SupervisorIntern {
  taskCount: number
  taskDoneCount: number
  deliverableCount: number
  deliverableApprovedCount: number
  progressPercent: number
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
  submittedAt: string
  validatedAt?: string | null
  submittedBy?: {
    id: string
    name: string
    email: string
  } | null
}

export interface SupervisorDeliverable {
  id: string
  missionId: string
  supervisorId: string
  internId: string | null
  internName?: string
  title: string
  description?: string
  status: DeliverableStatus
  version: number
  fileUrl: string
  rowVersion?: string
  rawProgress: number
  weight: number
  dueDate?: string | null
  submittedDate?: string | null
  supervisorComment?: string | null
  createdAt?: string
  versions?: DeliverableVersion[]
  tasks?: SupervisorTask[]
}

export interface DeliverableQueueItem {
  id: string
  title: string
  internId: string | null
  internName: string
  submittedDate: string | null
  dueDate: string | null
  status: DeliverableStatus
  version: number
  fileUrl: string
  rowVersion?: string
  rawProgress: number
  tasks: SupervisorTask[]
}

export interface SupervisorTask {
  id: string
  internId: string
  deliverableId?: string | null
  title: string
  description?: string
  dueDate?: string | null
  status: TaskStatus
  deliverableTitle?: string
  rowVersion?: string
  completedAt?: string | null
  createdAt?: string
}

export interface SupervisorMeeting {
  id: string
  supervisorId: string
  internId: string
  internName?: string
  date: string
  notes: string
  parsedTitle?: string
  parsedMeetingUrl?: string
  parsedBody?: string
  createdAt?: string
}

export interface SupervisorEvaluation {
  id: string
  internId: string
  internName?: string
  deliverableId?: string | null
  deliverableTitle?: string
  deliverableStatus?: DeliverableStatus
  // TODO: confirm enum values with backend
  type: string
  status: string
  technicalScore: number
  autonomyScore: number
  communicationScore: number
  deadlineRespectScore: number
  deliverableQualityScore: number
  overallScore?: number | null
  comments?: string
  privateNotes?: string
  isReleasedToIntern: boolean
  releasedAt?: string | null
  submittedAt?: string
  createdAt?: string
}

export interface SupervisorWorkload {
  currentInternCount: number
  maxCapacity: number | null
  utilizationPercent?: number
  pfeCount: number
  summerCount: number
  otherCount: number
}

export interface CreateDeliverableRequest {
  MissionId: string
  InternId?: string
  Title: string
  Description?: string
  DueDate?: string
  Weight?: number
}

export type UpdateDeliverableRequest = Partial<Omit<CreateDeliverableRequest, 'MissionId' | 'InternId' | 'DueDate'>> & {
  DueDate?: string | null
}

export interface RejectDeliverableRequest {
  Reason: string
  TaskIdsToReopen: string[]
  RowVersion: string
}

export interface CreateTaskRequest {
  InternId: string
  DeliverableId?: string
  Title: string
  Description?: string
  DueDate?: string
}

export type UpdateTaskRequest = Partial<Omit<CreateTaskRequest, 'InternId'>>

export interface CreateMeetingRequest {
  SupervisorId: string
  InternId: string
  Date: string
  Notes: string
}

export interface UpdateMeetingRequest {
  Date: string
  Notes: string
}

export interface UpdateMissionRequest {
  Title?: string
  Description?: string
  Skills?: string[]
  Tools?: string
  Level?: string
  Status?: MissionStatus
  StartDate?: string | null
  EndDate?: string | null
  CoSupervisorId?: string
  CoSupervisorCanReview?: boolean
  CoSupervisorCanEval?: boolean
}
import type {
  CardConfig,
  DashboardCard,
  MissionCardConfig as MissionFeatureFlagConfig,
} from './missionFeatureFlags'

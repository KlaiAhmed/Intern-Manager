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
  /** Optimistic concurrency token. Backend stores this as a numeric column. */
  rowVersion?: number
  cardConfig?: MissionCardConfig
  history?: MissionHistoryEntry[]
}

/**
 * Supervisor-scope intern card. Sourced from `GET /api/supervisor/me/interns`,
 * which returns `{ id, name, missionTitle, progress, lastJournalDate, isOverdue }`.
 *
 * `firstName`/`lastName`/`email`/`status` are kept optional for backward compatibility
 * with consumers that previously assumed the legacy `/api/supervisor/interns` shape;
 * the supervisor-scope endpoint does not surface them today.
 */
export interface SupervisorIntern {
  id: string
  firstName?: string
  lastName?: string
  fullName: string
  email?: string
  missionId?: string | null
  missionTitle?: string
  startDate?: string | null
  endDate?: string | null
  status?: string
  verificationStatus?: string
  /** Average deliverable progress (0–100) as computed by the supervisor list endpoint. */
  progressPercent?: number
  /** Last journal entry timestamp, surfaced by `/api/supervisor/me/interns`. */
  lastJournalDate?: string | null
  /** Whether the intern has at least one overdue deliverable. */
  isOverdue?: boolean
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
  /** Optimistic concurrency token. Backend stores this as a numeric column. */
  rowVersion?: number
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
  /** Optimistic concurrency token. Backend stores this as a numeric column. */
  rowVersion?: number
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
  /** Optimistic concurrency token. Backend stores this as a numeric column. */
  rowVersion?: number
  completedAt?: string | null
  createdAt?: string
}

export interface SupervisorMeeting {
  id: string
  supervisorId: string
  internId: string
  internName?: string
  date: string
  /**
   * First-class meeting title from `Meeting.Title` (nullable on the backend).
   * Older records that pre-date the column may still encode the title inside `notes`;
   * consumers should fall back to `parsedTitle` for those.
   */
  title?: string | null
  /**
   * First-class video conference URL from `Meeting.MeetingUrl` (nullable on the backend).
   * Older records may encode the URL inside `notes`; consumers should fall back to
   * `parsedMeetingUrl` for those.
   */
  meetingUrl?: string | null
  notes: string
  /** Legacy fallback parsed from `notes` for back-compat with the pre-Title/MeetingUrl schema. */
  parsedTitle?: string
  /** Legacy fallback parsed from `notes` for back-compat with the pre-Title/MeetingUrl schema. */
  parsedMeetingUrl?: string
  /** Legacy fallback for the notes body when the legacy encoding stripped TITLE:/URL: lines. */
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

/**
 * `POST /api/deliverables` body. Backend `AssignDeliverableRequest` requires
 * `InternId` (non-empty Guid). `Weight` is intentionally absent because the
 * backend does not accept it on create today.
 */
export interface CreateDeliverableRequest {
  MissionId: string
  InternId: string
  Title: string
  Description?: string
  DueDate?: string | null
}

/**
 * `PUT /api/deliverables/{id}` is not yet implemented by the backend.
 * Type retained for future wiring; consumers should treat the mutation as
 * a Step 2 follow-up until the controller route exists.
 */
export type UpdateDeliverableRequest = Partial<Omit<CreateDeliverableRequest, 'MissionId' | 'InternId'>>

/**
 * `POST /api/deliverables/{id}/reject` body. `RowVersion` is the numeric
 * concurrency token returned by the deliverable read endpoints.
 */
export interface RejectDeliverableRequest {
  Reason: string
  TaskIdsToReopen: string[]
  RowVersion: number
}

export interface ApproveDeliverableRequest {
  RowVersion: number
}

export interface CreateTaskRequest {
  InternId: string
  DeliverableId?: string
  Title: string
  Description?: string
  DueDate?: string
}

export type UpdateTaskRequest = Partial<Omit<CreateTaskRequest, 'InternId'>>

/**
 * `POST /api/meetings` body. The backend reads `SupervisorId` from the JWT,
 * so the client must not send it. `Title` and `MeetingUrl` are first-class
 * columns and should be supplied directly instead of being encoded into `Notes`.
 */
export interface CreateMeetingRequest {
  InternId: string
  Date: string
  Title?: string | null
  MeetingUrl?: string | null
  Notes?: string
}

/**
 * `PATCH /api/meetings/{id}` body. All fields are optional patches.
 * `Title` and `MeetingUrl` map to first-class columns on the `Meeting` entity.
 */
export interface UpdateMeetingRequest {
  Date?: string
  Title?: string | null
  MeetingUrl?: string | null
  Notes?: string | null
}

/**
 * `PATCH /api/missions/{id}` body. The `Status` field is currently ignored by
 * the controller; status transitions go through dedicated POST endpoints
 * (`/pause`, `/resume`, `/archive`). `StartDate`/`EndDate` are not yet accepted
 * by the backend either — sending them is a no-op until the API is extended.
 */
export interface UpdateMissionRequest {
  Title?: string
  Description?: string
  Skills?: string[]
  Tools?: string
  Level?: string
  CoSupervisorId?: string
  CoSupervisorCanReview?: boolean
  CoSupervisorCanEval?: boolean
}
import type {
  CardConfig,
  DashboardCard,
  MissionCardConfig as MissionFeatureFlagConfig,
} from './missionFeatureFlags'

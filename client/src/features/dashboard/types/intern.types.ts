import type { MissionCardConfig } from './missionFeatureFlags'

export type Guid = string
export type IsoDateTimeString = string

export const internDashboardTabs = [
  'overview',
  'mission',
  'tasks',
  'deliverables',
  'journal',
  'evaluations',
  'meetings',
  'profile',
] as const

export type InternDashboardTab = (typeof internDashboardTabs)[number]

export interface InternTabVisibility {
  isVisible: boolean
  isLoading: boolean
}

export type InternTabVisibilityMap = Record<InternDashboardTab, InternTabVisibility>

export type InternVerificationStatus = 'INCOMPLETE' | 'PENDING' | 'ACTIVE' | 'NOT_APPLICABLE'
export type InternLifecycleStatus = InternVerificationStatus | 'COMPLETED' | 'ARCHIVED'
export type UserAccountStatus = 'Active' | 'Archived'
export type InternDeliverableStatus = 'not_submitted' | 'submitted' | 'accepted' | 'rejected'
export type InternEvaluationType = 'mid_term' | 'end_of_internship'

export interface InternDashboardPagedResponse<TItem> {
  data: TItem[]
  total: number
  page: number
  limit: number
}

export interface InternDashboardActionResponse {
  success: boolean
  message?: string | null
}

export interface InternDetailSkillResponse {
  id: Guid
  name: string
}

export interface InternCurrentInternshipSupervisorResponse {
  id: Guid
  name: string
  email: string
}

export interface InternCurrentInternshipMissionResponse {
  id: Guid
  title: string
}

export interface InternCurrentInternshipResponse {
  id: Guid
  type: string | null
  department: string | null
  startDate: IsoDateTimeString | null
  endDate: IsoDateTimeString | null
  status: string
  supervisor: InternCurrentInternshipSupervisorResponse | null
  mission: InternCurrentInternshipMissionResponse
}

export interface InternDetailResponse {
  id: Guid
  firstName: string
  lastName: string
  fullName: string
  email: string
  status: InternVerificationStatus
  accountStatus: UserAccountStatus
  verificationStatus: InternVerificationStatus
  cvFileUrl: string | null
  startDate: IsoDateTimeString | null
  endDate: IsoDateTimeString | null
  phone: string | null
  school: string | null
  specialty: string | null
  level: string | null
  skills: InternDetailSkillResponse[]
  currentInternship: InternCurrentInternshipResponse | null
}

export interface InternCurrentMissionSummaryResponse {
  id: Guid
  missionTitle: string
  supervisorName: string
  coSupervisorName: string | null
  department: string
  startDate: IsoDateTimeString | null
  endDate: IsoDateTimeString | null
  status: InternVerificationStatus
  verificationStatus: InternVerificationStatus
  progress: number
}

export interface InternMissionHistoryResponse {
  missions: InternMissionHistoryItemResponse[]
}

export interface InternMissionHistoryItemResponse {
  id: Guid
  missionTitle: string
  status: string
  startDate: IsoDateTimeString
  endDate: IsoDateTimeString | null
  progress: number
  supervisorName: string
  coSupervisorName: string | null
  departmentName: string | null
  type: string | null
  assignedAt: IsoDateTimeString | null
}

export interface InternMissionFeatureFlagsResponse {
  data: MissionCardConfig | null
}

export type InternMissionDocumentSourceType = 'file' | 'url' | string

export interface InternMissionDocumentResponse {
  id: Guid
  missionId: Guid
  fileName: string
  fileUrl: string
  uploadedAt: IsoDateTimeString
  sourceType: InternMissionDocumentSourceType
}

export type InternMissionDocumentsResponse = InternMissionDocumentResponse[]

export interface InternTaskResponse {
  id: Guid
  title: string
  dueDate: IsoDateTimeString | null
  status: string
  rowVersion: number
}

export interface CompleteInternTaskResponse {
  id: Guid
  status: string
}

export interface InternDeliverableResponse {
  id: Guid
  title: string
  dueDate: IsoDateTimeString | null
  status: InternDeliverableStatus
  version: number
  supervisorComment: string | null
  progress: number
  missionId: Guid
  weight: number
  rowVersion: number
}

export interface DeliverableVersionSubmittedByResponse {
  id: Guid
  name: string
  email: string
}

export interface DeliverableVersionResponse {
  id: Guid
  deliverableId: Guid
  versionNumber: number
  fileUrl: string | null
  gitHubUrl: string | null
  gitHubBranch: string | null
  message: string | null
  status: string
  supervisorComment: string | null
  submittedAt: IsoDateTimeString
  validatedAt: IsoDateTimeString | null
  submittedBy: DeliverableVersionSubmittedByResponse | null
}

export interface DeliverableVersionParentSummaryResponse {
  id: Guid
  missionId: Guid
  title: string
  status: string
  version: number
  progress: number
  dueDate: IsoDateTimeString | null
  submittedDate: IsoDateTimeString | null
  supervisorComment: string | null
}

export interface DeliverableVersionHistoryResponse {
  deliverable: DeliverableVersionParentSummaryResponse
  versions: DeliverableVersionResponse[]
}

export interface SubmitDeliverableVersionRequest {
  deliverableId: Guid
  rowVersion: number
  file?: File | null
  gitHubUrl?: string | null
  gitHubBranch?: string | null
  message?: string | null
}

export interface JournalCommentResponse {
  id: number
  content: string
  createdAt: IsoDateTimeString
  authorId: Guid
}

export interface JournalEvaluationLinkResponse {
  id: number
  criteria: number
  linkedByUserId: Guid
  createdAt: IsoDateTimeString
}

export interface InternJournalEntryResponse {
  id: Guid
  content: string
  isReviewed: boolean
  comments: JournalCommentResponse[]
  evaluationLinks: JournalEvaluationLinkResponse[]
  createdAt: IsoDateTimeString
}

export interface InternJournalEntriesResponse {
  data: InternJournalEntryResponse[]
}

export interface CreateJournalEntryRequest {
  content: string
}

export interface CreatedJournalEntryResponse {
  id: Guid
  content: string
  createdAt: IsoDateTimeString
}

export interface EvaluationCriteriaResponse {
  technical: number
  autonomy: number
  communication: number
  deadlineRespect: number
  deliverableQuality: number
}

export interface InternEvaluationResponse {
  id: Guid
  type: InternEvaluationType
  status: string
  criteria: EvaluationCriteriaResponse
  overallScore: number | null
  isReleasedToIntern: boolean
  releasedAt: IsoDateTimeString | null
  date: IsoDateTimeString
  comments: string
  supervisorName: string
}

export interface InternEvaluationsResponse {
  data: InternEvaluationResponse[]
  page: number
  pageSize: number
  total: number
}

export interface InternMeetingResponse {
  id: Guid
  date: IsoDateTimeString
  supervisorName: string
  notes: string
}

export interface InternMeetingDetailResponse extends InternMeetingResponse {
  internId: Guid
  internName: string
  supervisorId: Guid
}

export interface InternMeetingsResponse {
  data: InternMeetingResponse[]
  total: number
  page: number
  limit: number
}

export interface InternMeetingsCountResponse {
  count: number
}

export interface InternProfileResponse {
  id: Guid
  universityId: Guid | null
  major: string
  currentYearOfStudy: string
  expectedGraduationDate: IsoDateTimeString | null
  workPreference: string | null
  phoneNumber: string | null
  cvFileUrl: string | null
  status: InternVerificationStatus
  verificationStatus: InternVerificationStatus
  startDate: IsoDateTimeString | null
  endDate: IsoDateTimeString | null
  skills: string[]
}

export interface UpdateInternProfileRequest {
  universityId?: Guid | null
  major?: string | null
  currentYearOfStudy?: string | null
  expectedGraduationDate?: IsoDateTimeString | null
  startDate?: IsoDateTimeString | null
  endDate?: IsoDateTimeString | null
  workPreference?: string | null
  phoneNumber?: string | null
}

export interface ReplaceInternSkillsRequest {
  skillIds: Guid[]
}

export interface ReplaceInternSkillsResponse {
  data: InternDetailSkillResponse[]
}

export interface CvUploadResponse {
  fileUrl: string | null
  status: InternVerificationStatus
  verificationStatus: InternVerificationStatus
}

export interface ReferentialResponse {
  id: Guid
  name: string
}

export interface InternNotificationResponse {
  notificationId: number
  type: string
  message: string
  relatedEntityId: number | null
  isRead: boolean
  createdAt: IsoDateTimeString
}

export interface InternNotificationPageResponse {
  data: InternNotificationResponse[]
  total: number
  page: number
  pageSize: number
}

export interface MarkAllInternNotificationsReadResponse {
  updatedCount: number
}

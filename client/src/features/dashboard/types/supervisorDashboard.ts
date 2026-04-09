export type SupervisorNotificationType =
  | 'new-submission'
  | 'rejected-deliverable'
  | 'meeting-reminder'
  | 'generic'

export interface SupervisorNotificationItem {
  id: string
  type: string
  title: string
  message: string
  relatedEntity: string
  isRead: boolean
  createdAt: string
  readAt: string | null
}

export interface SupervisorKpis {
  activeInterns: number
  pendingDeliverables: number
  internsBehind: number
  avgValidationDelayDays: number
  validationDelaySampleSize: number
}

export interface SupervisorInternProgressItem {
  internId: string
  fullName: string
  missionTitle: string
  stageType: string
  progress: number
  status: string
  isLate: boolean
}

export interface SupervisorWorkload {
  currentInternCount: number
  maxCapacity: number | null
  utilizationPercent: number | null
  pfeCount: number
  summerCount: number
  otherCount: number
}

export interface SupervisorDelayAlertItem {
  internId: string
  internName: string
  deliverableId: string
  deliverableTitle: string
  dueDate: string
  daysOverdue: number
  severity: string
}

export interface SupervisorValidationQueueItem {
  id: string
  title: string
  internId: string | null
  internName: string
  submittedDate: string | null
  dueDate: string | null
  status: string
  version: number
  fileUrl: string
}

export interface SupervisorMeetingItem {
  id: string
  internId: string
  internName: string
  date: string
  notes: string
}

export interface SupervisorMeetingForm {
  internId: string
  date: string
  note: string
}

export interface SupervisorEvaluationDueItem {
  evaluationId: string
  internId: string
  internName: string
  type: string
}

export interface SupervisorEvaluationCompletedItem {
  evaluationId: string
  internId: string
  internName: string
  type: string
  averageScore: number
  submittedAt: string
}

export interface SupervisorEvaluationStatus {
  due: SupervisorEvaluationDueItem[]
  completed: SupervisorEvaluationCompletedItem[]
}

export interface SupervisorEvaluationScores {
  technical: number
  autonomy: number
  communication: number
  deadlineRespect: number
  deliverableQuality: number
}

export interface SupervisorEvaluationCriterionComments {
  technical: string
  autonomy: string
  communication: string
  deadlineRespect: string
  deliverableQuality: string
}

export interface SupervisorEvaluationForm {
  scores: SupervisorEvaluationScores
  criterionComments: SupervisorEvaluationCriterionComments
  generalComment: string
}

export interface PagedResponse<T> {
  data?: T[]
  total?: number
  page?: number
  limit?: number
}

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useI18n } from '../../../../locales/I18nContext'
import { useAuth } from '../../../../stores/AuthContext'
import { toErrorMessage } from '../../shared/utils/errorMessage'
import { getInitials, getFirstName } from '../../shared/utils/userUtils'
import type {
  Deliverable,
  Evaluation,
  InternLifecycleStatus,
  InternProfileReadOnly,
  Internship,
  JournalEntry,
  Meeting,
  PendingInternProfile,
  Task,
} from '../../types/internDashboard'
import type {
  InternCurrentMissionSummaryResponse,
  InternDetailResponse,
  InternJournalEntryResponse,
  InternNotificationResponse,
  InternProfileResponse,
  InternTaskResponse,
  InternDeliverableResponse,
  InternEvaluationResponse,
  InternMeetingResponse,
} from '../../types/intern.types'
import { useInternDeliverables } from './useInternDeliverables'
import { useInternEvaluations } from './useInternEvaluations'
import { useInternJournal } from './useInternJournal'
import { useInternLifecycleStatus } from './useInternLifecycleStatus'
import { useInternMeetings } from './useInternMeetings'
import { useInternMission } from './useInternMission'
import { useInternNotifications } from './useInternNotifications'
import { useInternProfile } from './useInternProfile'
import { useInternTasks } from './useInternTasks'
import {
  computeInternTabVisibility,
  getFirstVisibleInternTab,
  isInternDashboardTab,
} from './internTabVisibility'
import type { InternDashboardTab } from '../../types/intern.types'

export { computeInternTabVisibility } from './internTabVisibility'

const defaultPendingNotificationMessage = 'Your profile is awaiting assignment'

const emptyEvaluationScores: Evaluation['scores'] = {
  technical: 0,
  autonomy: 0,
  communication: 0,
  deadlineRespect: 0,
  deliverableQuality: 0,
}

function resolveLifecycleStatus(status: InternDetailResponse | undefined): InternLifecycleStatus | null {
  if (!status) {
    return null
  }

  if (status.accountStatus === 'Archived') {
    return 'ARCHIVED'
  }

  if (status.currentInternship?.status.toLowerCase() === 'completed') {
    return 'COMPLETED'
  }

  return status.status
}

function toDashboardInternship(response: InternCurrentMissionSummaryResponse | null): Internship | null {
  if (!response) {
    return null
  }

  return {
    id: response.id,
    missionTitle: response.missionTitle,
    supervisorName: response.supervisorName,
    department: response.department,
    startDate: response.startDate,
    endDate: response.endDate,
    status: response.status,
    progress: response.progress,
  }
}

function toDashboardTask(task: InternTaskResponse): Task {
  return {
    id: task.id,
    title: task.title,
    dueDate: task.dueDate,
    status: task.status,
  }
}

function toDashboardDeliverable(deliverable: InternDeliverableResponse): Deliverable {
  return {
    id: deliverable.id,
    title: deliverable.title,
    dueDate: deliverable.dueDate,
    status: deliverable.status,
    version: deliverable.version,
    supervisorComment: deliverable.supervisorComment ?? undefined,
    progress: deliverable.progress,
  }
}

function toDashboardJournalEntry(entry: InternJournalEntryResponse): JournalEntry {
  return {
    id: entry.id,
    content: entry.content,
    isReviewed: entry.isReviewed,
    comments: entry.comments,
    evaluationLinks: entry.evaluationLinks.map((link) => ({
      ...link,
      criteria: String(link.criteria),
    })),
    createdAt: entry.createdAt,
  }
}

function toDashboardEvaluation(evaluation: InternEvaluationResponse): Evaluation {
  return {
    id: evaluation.id,
    type: evaluation.type,
    scores: evaluation.criteria ?? emptyEvaluationScores,
    comments: evaluation.comments,
    date: evaluation.date,
    isReleasedToIntern: evaluation.isReleasedToIntern,
    releasedAt: evaluation.releasedAt,
  }
}

function toDashboardMeeting(meeting: InternMeetingResponse | null): Meeting | null {
  if (!meeting) {
    return null
  }

  return {
    id: meeting.id,
    date: meeting.date,
    supervisorName: meeting.supervisorName,
    notes: meeting.notes,
  }
}

function toReadOnlyProfile(profile: InternProfileResponse): InternProfileReadOnly {
  return {
    id: profile.id,
    universityId: profile.universityId,
    major: profile.major,
    currentYearOfStudy: profile.currentYearOfStudy,
    expectedGraduationDate: profile.expectedGraduationDate,
    workPreference: profile.workPreference,
    phoneNumber: profile.phoneNumber,
    cvFileUrl: profile.cvFileUrl,
    status: profile.status,
    verificationStatus: profile.verificationStatus,
    startDate: profile.startDate,
    endDate: profile.endDate,
    skills: profile.skills.map((skill) => ({
      id: skill,
      name: skill,
    })),
  }
}

function toPendingProfile(
  profile: InternProfileResponse | null,
  universityName: string | null,
): PendingInternProfile | null {
  if (!profile) {
    return null
  }

  return {
    ...toReadOnlyProfile(profile),
    universityName,
  }
}

function findPendingNotificationMessage(notifications: InternNotificationResponse[]): string {
  const lifecycleNotification = notifications.find((item) =>
    item.type === 'intern.profile.pending-assignment' || item.type === 'intern.cv.submitted')

  return lifecycleNotification?.message?.trim() || defaultPendingNotificationMessage
}

export function useInternDashboard() {
  const { t } = useI18n()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const statusQuery = useInternLifecycleStatus(user?.id, {
    enabled: Boolean(user?.id),
  })
  const internLifecycleStatus = useMemo(
    () => resolveLifecycleStatus(statusQuery.data),
    [statusQuery.data],
  )

  const isActiveIntern = internLifecycleStatus === 'ACTIVE'
  const shouldLoadPendingContext = internLifecycleStatus === 'PENDING'
  const shouldLoadProfile = shouldLoadPendingContext || isActiveIntern

  const mission = useInternMission({ enabled: isActiveIntern })
  const tasks = useInternTasks({ enabled: isActiveIntern })
  const deliverables = useInternDeliverables({ enabled: isActiveIntern })
  const journal = useInternJournal({ enabled: isActiveIntern, limit: 5 })
  const evaluations = useInternEvaluations({ enabled: isActiveIntern })
  const meetings = useInternMeetings({ enabled: isActiveIntern })
  const profile = useInternProfile({ enabled: shouldLoadProfile })
  const notifications = useInternNotifications({
    enabled: Boolean(user?.id),
    isRead: false,
    page: 1,
    pageSize: 20,
    refetchIntervalMs: 60_000,
  })

  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false)
  const [journalContent, setJournalContent] = useState('')
  const [selectedDeliverableForUpload, setSelectedDeliverableForUpload] = useState<string | null>(null)
  const [commentModalDeliverable, setCommentModalDeliverable] = useState<Deliverable | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const activeTab = useMemo<InternDashboardTab>(() => {
    const tab = searchParams.get('tab')
    return isInternDashboardTab(tab) ? tab : 'overview'
  }, [searchParams])

  const setActiveTab = useCallback(
    (tab: InternDashboardTab) => {
      setSearchParams((currentParams) => {
        const nextParams = new URLSearchParams(currentParams)
        nextParams.set('tab', tab)
        return nextParams
      })
    },
    [setSearchParams],
  )

  const tabVisibility = useMemo(
    () => computeInternTabVisibility({
      lifecycleStatus: internLifecycleStatus,
      missionFlags: mission.featureFlags,
      missionFlagsLoading: mission.featureFlagsQuery.isLoading,
    }),
    [internLifecycleStatus, mission.featureFlags, mission.featureFlagsQuery.isLoading],
  )

  useEffect(() => {
    const rawTab = searchParams.get('tab')
    if (rawTab !== null && !isInternDashboardTab(rawTab)) {
      setActiveTab('overview')
    }
  }, [searchParams, setActiveTab])

  useEffect(() => {
    const visibility = tabVisibility[activeTab]
    if (visibility.isLoading || visibility.isVisible) {
      return
    }

    setActiveTab(getFirstVisibleInternTab(tabVisibility))
  }, [activeTab, setActiveTab, tabVisibility])

  const internship = useMemo(
    () => toDashboardInternship(mission.internship),
    [mission.internship],
  )

  const dashboardTasks = useMemo(
    () => tasks.tasks.map(toDashboardTask),
    [tasks.tasks],
  )

  const dashboardDeliverables = useMemo(
    () => deliverables.deliverables.map(toDashboardDeliverable),
    [deliverables.deliverables],
  )

  const journalEntries = useMemo(
    () => journal.entries.map(toDashboardJournalEntry),
    [journal.entries],
  )

  const dashboardEvaluations = useMemo(
    () => evaluations.evaluations.map(toDashboardEvaluation),
    [evaluations.evaluations],
  )

  const nextMeeting = useMemo(
    () => toDashboardMeeting(meetings.nextMeeting),
    [meetings.nextMeeting],
  )

  const pendingNotificationMessage = useMemo(
    () => findPendingNotificationMessage(notifications.notifications),
    [notifications.notifications],
  )

  const pendingProfile = useMemo(() => {
    const universityName = profile.schools.find((school) => school.id === profile.profile?.universityId)?.name ?? null
    return toPendingProfile(profile.profile, universityName)
  }, [profile.profile, profile.schools])

  const loadInternLifecycleStatus = useCallback(async () => {
    await statusQuery.refetch()
  }, [statusQuery])

  const loadInternship = useCallback(async () => {
    await mission.summaryQuery.refetch()
  }, [mission.summaryQuery])

  const loadTasks = useCallback(async () => {
    await tasks.refetch()
  }, [tasks])

  const loadDeliverables = useCallback(async () => {
    await deliverables.refetch()
  }, [deliverables])

  const loadJournal = useCallback(async () => {
    await journal.refetch()
  }, [journal])

  const loadEvaluations = useCallback(async () => {
    await evaluations.refetch()
  }, [evaluations])

  const loadNextMeeting = useCallback(async () => {
    await meetings.nextMeetingQuery.refetch()
  }, [meetings.nextMeetingQuery])

  const handleCompleteTask = async (taskId: string, rowVersion: number) => {
    try {
      await tasks.completeTask({ taskId, rowVersion })
    } catch {
      // React Query exposes the mutation error through tasks.error.
    }
  }

  const handleAddJournalEntry = async () => {
    if (!journalContent.trim()) {
      setFormError(t('dashboard.form.required'))
      return
    }

    try {
      await journal.addEntry({ content: journalContent })
      setIsJournalModalOpen(false)
      setJournalContent('')
      setFormError(null)
    } catch (error) {
      setFormError(toErrorMessage(error, t('dashboard.error.load')))
    }
  }

  const handleFileUpload = async (deliverableId: string, file: File) => {
    try {
      await deliverables.submitFile({ deliverableId, file })
      setSelectedDeliverableForUpload(null)
    } catch {
      // React Query exposes the mutation error through deliverables.error.
    }
  }

  const handleUploadClick = (id: string) => {
    setSelectedDeliverableForUpload(id)
    setTimeout(() => fileInputRef.current?.click(), 0)
  }

  const handleHiddenFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && selectedDeliverableForUpload) {
      void handleFileUpload(selectedDeliverableForUpload, file)
    }
    event.target.value = ''
  }

  const getUserInitials = () => getInitials(user?.name ?? '', 'IN')

  const getFirstNameFromUser = () => getFirstName(user?.name ?? '')

  const statusError = !user?.id
    ? 'Unable to resolve current intern id.'
    : statusQuery.error
      ? toErrorMessage(statusQuery.error, t('dashboard.error.load'))
      : null

  const internshipError = mission.summaryQuery.error
    ? toErrorMessage(mission.summaryQuery.error, t('dashboard.error.load'))
    : null
  const tasksError = tasks.error ? toErrorMessage(tasks.error, t('dashboard.error.load')) : null
  const deliverablesError = deliverables.error ? toErrorMessage(deliverables.error, t('dashboard.error.load')) : null
  const journalError = journal.journalQuery.error ? toErrorMessage(journal.journalQuery.error, t('dashboard.error.load')) : null
  const evaluationsError = evaluations.error ? toErrorMessage(evaluations.error, t('dashboard.error.load')) : null
  const meetingError = meetings.nextMeetingQuery.error ? toErrorMessage(meetings.nextMeetingQuery.error, t('dashboard.error.load')) : null

  return {
    t,
    user,
    fileInputRef,

    internship,
    tasks: dashboardTasks,
    deliverables: dashboardDeliverables,
    journalEntries,
    evaluations: dashboardEvaluations,
    nextMeeting,
    meetingsCount: meetings.upcomingCount,
    internLifecycleStatus,
    pendingNotificationMessage,
    pendingProfile,

    activeTab,
    setActiveTab,
    tabVisibility,
    missionFlags: mission.featureFlags,
    missionFlagsLoading: mission.featureFlagsQuery.isLoading,
    unreadNotificationCount: notifications.unreadCount,

    isJournalModalOpen,
    journalContent,
    selectedDeliverableForUpload,
    commentModalDeliverable,

    loadingInternship: mission.summaryQuery.isLoading,
    loadingTasks: tasks.isLoading,
    loadingDeliverables: deliverables.isLoading,
    loadingJournal: journal.isLoading,
    loadingEvaluations: evaluations.isLoading,
    loadingMeeting: meetings.nextMeetingQuery.isLoading,
    loadingMeetingsCount: meetings.countQuery.isLoading,
    statusLoading: Boolean(user?.id) && statusQuery.isLoading,

    internshipError,
    tasksError,
    deliverablesError,
    journalError,
    evaluationsError,
    meetingError,
    statusError,
    formError,

    setIsJournalModalOpen,
    setJournalContent,
    setCommentModalDeliverable,

    loadInternLifecycleStatus,
    loadInternship,
    loadTasks,
    loadDeliverables,
    loadJournal,
    loadEvaluations,
    loadNextMeeting,

    handleCompleteTask,
    handleAddJournalEntry,
    handleUploadClick,
    handleHiddenFileChange,

    getUserInitials,
    getFirstName: getFirstNameFromUser,
  }
}

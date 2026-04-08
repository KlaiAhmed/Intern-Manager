import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { useAuth } from '../../../../stores/AuthContext'
import { useDashboardApi } from '../useDashboardApi'
import type {
  Deliverable,
  Evaluation,
  InternLifecycleStatus,
  InternProfileReadOnly,
  Internship,
  InternStatusResponse,
  JournalEntry,
  Meeting,
  NotificationItem,
  Task,
} from '../../types/internDashboard'

export function useInternDashboard() {
  const { t } = useI18n()
  const { user } = useAuth()
  const api = useDashboardApi()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [internship, setInternship] = useState<Internship | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([])
  const [evaluations, setEvaluations] = useState<Evaluation[]>([])
  const [nextMeeting, setNextMeeting] = useState<Meeting | null>(null)
  const [meetingsCount, setMeetingsCount] = useState(0)
  const [internLifecycleStatus, setInternLifecycleStatus] = useState<InternLifecycleStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [pendingNotificationMessage, setPendingNotificationMessage] = useState('Your profile is awaiting assignment')
  const [pendingProfile, setPendingProfile] = useState<InternProfileReadOnly | null>(null)

  const [isJournalModalOpen, setIsJournalModalOpen] = useState(false)
  const [journalContent, setJournalContent] = useState('')
  const [selectedDeliverableForUpload, setSelectedDeliverableForUpload] = useState<string | null>(null)
  const [commentModalDeliverable, setCommentModalDeliverable] = useState<Deliverable | null>(null)

  const [loadingInternship, setLoadingInternship] = useState(true)
  const [loadingTasks, setLoadingTasks] = useState(true)
  const [loadingDeliverables, setLoadingDeliverables] = useState(true)
  const [loadingJournal, setLoadingJournal] = useState(true)
  const [loadingEvaluations, setLoadingEvaluations] = useState(true)
  const [loadingMeeting, setLoadingMeeting] = useState(true)
  const [loadingMeetingsCount, setLoadingMeetingsCount] = useState(true)

  const [internshipError, setInternshipError] = useState<string | null>(null)
  const [tasksError, setTasksError] = useState<string | null>(null)
  const [deliverablesError, setDeliverablesError] = useState<string | null>(null)
  const [journalError, setJournalError] = useState<string | null>(null)
  const [evaluationsError, setEvaluationsError] = useState<string | null>(null)
  const [meetingError, setMeetingError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message.trim()) {
      return error.message
    }
    return t('dashboard.error.load')
  }

  const emptyEvaluationScores: Evaluation['scores'] = {
    technical: 0,
    autonomy: 0,
    communication: 0,
    deadlineRespect: 0,
    deliverableQuality: 0,
  }

  const loadInternLifecycleStatus = async () => {
    if (!user?.id) {
      setStatusError('Unable to resolve current intern id.')
      setStatusLoading(false)
      return
    }

    setStatusLoading(true)
    setStatusError(null)

    try {
      const result = await api.get<InternStatusResponse>(`/api/interns/${user.id}`)
      setInternLifecycleStatus(result.status)
    } catch (error) {
      setStatusError(getErrorMessage(error))
    } finally {
      setStatusLoading(false)
    }
  }

  const loadPendingContext = async () => {
    try {
      const [notificationsResult, profileResult] = await Promise.all([
        api.get<{ data?: NotificationItem[] }>('/api/notifications?unreadOnly=true&limit=20'),
        api.get<InternProfileReadOnly>('/api/intern/me/profile'),
      ])

      setPendingProfile(profileResult)

      const firstLifecycleNotification = (notificationsResult.data ?? []).find((item) =>
        item.type === 'intern.profile.pending-assignment' || item.type === 'intern.cv.submitted')

      if (firstLifecycleNotification?.message?.trim()) {
        setPendingNotificationMessage(firstLifecycleNotification.message)
      }
    } catch {
      setPendingProfile(null)
      setPendingNotificationMessage('Your profile is awaiting assignment')
    }
  }

  const loadInternship = async () => {
    setLoadingInternship(true)
    setInternshipError(null)
    try {
      const result = await api.get<Internship>('/api/intern/me/internship')
      setInternship(result)
    } catch (error) {
      setInternshipError(getErrorMessage(error))
    } finally {
      setLoadingInternship(false)
    }
  }

  const loadTasks = async () => {
    setLoadingTasks(true)
    setTasksError(null)
    try {
      const result = await api.get<{ data: Task[] }>('/api/intern/me/tasks')
      setTasks(result.data ?? [])
    } catch (error) {
      setTasksError(getErrorMessage(error))
    } finally {
      setLoadingTasks(false)
    }
  }

  const loadDeliverables = async () => {
    setLoadingDeliverables(true)
    setDeliverablesError(null)
    try {
      const result = await api.get<{ data: Deliverable[] }>('/api/intern/me/deliverables')
      setDeliverables(result.data ?? [])
    } catch (error) {
      setDeliverablesError(getErrorMessage(error))
    } finally {
      setLoadingDeliverables(false)
    }
  }

  const loadJournal = async () => {
    setLoadingJournal(true)
    setJournalError(null)
    try {
      const result = await api.get<{ data: JournalEntry[] }>('/api/intern/me/journal?limit=5')
      setJournalEntries(result.data ?? [])
    } catch (error) {
      setJournalError(getErrorMessage(error))
    } finally {
      setLoadingJournal(false)
    }
  }

  const loadEvaluations = async () => {
    setLoadingEvaluations(true)
    setEvaluationsError(null)
    try {
      const result = await api.get<{
        data: Array<{
          id: string
          type: Evaluation['type']
          scores?: Evaluation['scores']
          criteria?: Evaluation['scores']
          comments: string
          date?: string
          submittedAt?: string
        }>
      }>('/api/intern/me/evaluations')

      const normalizedEvaluations: Evaluation[] = (result.data ?? []).map((evaluation) => ({
        id: evaluation.id,
        type: evaluation.type,
        scores: evaluation.scores ?? evaluation.criteria ?? emptyEvaluationScores,
        comments: evaluation.comments,
        date: evaluation.date ?? evaluation.submittedAt ?? '',
      }))

      setEvaluations(normalizedEvaluations)
    } catch (error) {
      setEvaluationsError(getErrorMessage(error))
    } finally {
      setLoadingEvaluations(false)
    }
  }

  const loadMeetingsCount = async () => {
    setLoadingMeetingsCount(true)
    try {
      const result = await api.get<{ count?: number }>('/api/meetings?internId=me&upcoming=true&count=true')
      setMeetingsCount(typeof result.count === 'number' ? result.count : 0)
    } catch {
      setMeetingsCount(0)
    } finally {
      setLoadingMeetingsCount(false)
    }
  }

  const loadNextMeeting = async () => {
    setLoadingMeeting(true)
    setMeetingError(null)
    try {
      const result = await api.get<{ data?: Meeting[] }>('/api/meetings?internId=me&upcoming=true&limit=1')
      setNextMeeting(result.data?.[0] ?? null)
    } catch (error) {
      setMeetingError(getErrorMessage(error))
    } finally {
      setLoadingMeeting(false)
    }
  }

  useEffect(() => {
    void loadInternLifecycleStatus()
  }, [user?.id])

  useEffect(() => {
    if (internLifecycleStatus === 'ACTIVE') {
      void loadInternship()
      void loadTasks()
      void loadDeliverables()
      void loadJournal()
      void loadEvaluations()
      void loadNextMeeting()
      void loadMeetingsCount()
      return
    }

    if (internLifecycleStatus === 'PENDING') {
      void loadPendingContext()
    }
  }, [internLifecycleStatus])

  const handleCompleteTask = async (taskId: string) => {
    try {
      await api.patch(`/api/tasks/${taskId}/complete`, {})
      void loadTasks()
    } catch (error) {
      setTasksError(getErrorMessage(error))
    }
  }

  const handleAddJournalEntry = async () => {
    if (!journalContent.trim()) {
      setFormError(t('dashboard.form.required'))
      return
    }
    try {
      await api.post('/api/intern/me/journal', { content: journalContent })
      setIsJournalModalOpen(false)
      setJournalContent('')
      setFormError(null)
      void loadJournal()
    } catch (error) {
      setFormError(getErrorMessage(error))
    }
  }

  const handleFileUpload = async (deliverableId: string, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    try {
      await api.postFormData(`/api/deliverables/${deliverableId}/submit`, formData)
      setSelectedDeliverableForUpload(null)
      void loadDeliverables()
    } catch (error) {
      setDeliverablesError(getErrorMessage(error))
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

  const getUserInitials = () => {
    if (!user?.name) return 'IN'
    const names = user.name.split(' ')
    return names.map((namePart) => namePart[0]).join('').toUpperCase().slice(0, 2)
  }

  const getFirstName = () => {
    if (!user?.name) return ''
    return user.name.split(' ')[0]
  }

  const handleCvUploaded = (status: InternLifecycleStatus) => {
    setInternLifecycleStatus(status)
    setPendingNotificationMessage('Your profile is awaiting assignment')
    void loadPendingContext()
  }

  return {
    t,
    user,
    fileInputRef,

    internship,
    tasks,
    deliverables,
    journalEntries,
    evaluations,
    nextMeeting,
    meetingsCount,
    internLifecycleStatus,
    pendingNotificationMessage,
    pendingProfile,

    isJournalModalOpen,
    journalContent,
    selectedDeliverableForUpload,
    commentModalDeliverable,

    loadingInternship,
    loadingTasks,
    loadingDeliverables,
    loadingJournal,
    loadingEvaluations,
    loadingMeeting,
    loadingMeetingsCount,
    statusLoading,

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
    handleCvUploaded,

    getUserInitials,
    getFirstName,
  }
}


import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../../../locales/I18nContext'
import { useDashboardApi } from '../../hooks/useDashboardApi'
import type {
  Deliverable,
  Evaluation,
  Intern,
  Meeting,
  Mission,
  PendingInternOption,
  Skill,
} from './types'

export function useSupervisorDashboardState() {
  const { t } = useI18n()
  const api = useDashboardApi()
  const navigate = useNavigate()

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message.trim()) {
      return error.message
    }

    return t('dashboard.error.load')
  }

  const [activeInternsCount, setActiveInternsCount] = useState<number | null>(null)
  const [pendingValidationsCount, setPendingValidationsCount] = useState<number | null>(null)
  const [avgProgress, setAvgProgress] = useState<number | null>(null)
  const [overdueCount, setOverdueCount] = useState<number | null>(null)

  const [interns, setInterns] = useState<Intern[]>([])
  const [missions, setMissions] = useState<Mission[]>([])
  const [pendingDeliverables, setPendingDeliverables] = useState<Deliverable[]>([])
  const [pendingEvaluations, setPendingEvaluations] = useState<Evaluation[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [skills, setSkills] = useState<Skill[]>([])
  const [pendingInternOptions, setPendingInternOptions] = useState<PendingInternOption[]>([])
  const [successToast, setSuccessToast] = useState<string | null>(null)

  const [isCreateMissionModalOpen, setIsCreateMissionModalOpen] = useState(false)
  const [isAddMeetingModalOpen, setIsAddMeetingModalOpen] = useState(false)
  const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false)
  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false)
  const [selectedDeliverable, setSelectedDeliverable] = useState<Deliverable | null>(null)
  const [selectedEvaluation, setSelectedEvaluation] = useState<Evaluation | null>(null)

  const [missionFormData, setMissionFormData] = useState({
    title: '',
    description: '',
    skills: [] as string[],
    tools: '',
    level: 'junior',
    deliverables: '',
  })
  const [assignmentFormData, setAssignmentFormData] = useState({
    internId: '',
    startDate: '',
    endDate: '',
  })
  const [meetingFormData, setMeetingFormData] = useState({ internId: '', date: '', note: '' })
  const [validationComment, setValidationComment] = useState('')
  const [evaluationScores, setEvaluationScores] = useState({
    technical: 0,
    autonomy: 0,
    communication: 0,
    deadlineRespect: 0,
    deliverableQuality: 0,
    comments: '',
  })

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const [loadingKpis, setLoadingKpis] = useState(true)
  const [loadingInterns, setLoadingInterns] = useState(true)
  const [loadingMissions, setLoadingMissions] = useState(true)
  const [loadingDeliverables, setLoadingDeliverables] = useState(true)
  const [loadingEvaluations, setLoadingEvaluations] = useState(true)
  const [loadingMeetings, setLoadingMeetings] = useState(true)

  const [kpisError, setKpisError] = useState<string | null>(null)
  const [internsError, setInternsError] = useState<string | null>(null)
  const [missionsError, setMissionsError] = useState<string | null>(null)
  const [deliverablesError, setDeliverablesError] = useState<string | null>(null)
  const [evaluationsError, setEvaluationsError] = useState<string | null>(null)
  const [meetingsError, setMeetingsError] = useState<string | null>(null)

  const loadKpis = async () => {
    setLoadingKpis(true)
    setKpisError(null)
    try {
      const [activeInterns, pending, avg, overdue] = await Promise.all([
        api.get<{ count: number }>('/api/stats/supervisor/me/interns/active'),
        api.get<{ count: number }>('/api/stats/supervisor/me/deliverables/pending'),
        api.get<{ value: number }>('/api/stats/supervisor/me/avg-progress'),
        api.get<{ count: number }>('/api/stats/supervisor/me/overdue'),
      ])
      setActiveInternsCount(activeInterns.count)
      setPendingValidationsCount(pending.count)
      setAvgProgress(avg.value)
      setOverdueCount(overdue.count)
    } catch (error) {
      setKpisError(getErrorMessage(error))
    } finally {
      setLoadingKpis(false)
    }
  }

  const loadInterns = async () => {
    setLoadingInterns(true)
    setInternsError(null)
    try {
      const result = await api.get<{ data: Intern[] }>('/api/supervisor/me/interns')
      setInterns(result.data ?? [])
    } catch (error) {
      setInternsError(getErrorMessage(error))
    } finally {
      setLoadingInterns(false)
    }
  }

  const loadMissions = async () => {
    setLoadingMissions(true)
    setMissionsError(null)
    try {
      const result = await api.get<{ data: Mission[] }>('/api/missions?supervisorId=me')
      setMissions(result.data ?? [])
    } catch (error) {
      setMissionsError(getErrorMessage(error))
    } finally {
      setLoadingMissions(false)
    }
  }

  const loadDeliverables = async () => {
    setLoadingDeliverables(true)
    setDeliverablesError(null)
    try {
      const result = await api.get<{ data: Deliverable[] }>('/api/deliverables?status=pending&supervisorId=me')
      setPendingDeliverables(result.data ?? [])
    } catch (error) {
      setDeliverablesError(getErrorMessage(error))
    } finally {
      setLoadingDeliverables(false)
    }
  }

  const loadEvaluations = async () => {
    setLoadingEvaluations(true)
    setEvaluationsError(null)
    try {
      const result = await api.get<{ data: Evaluation[] }>('/api/evaluations/pending?supervisorId=me')
      setPendingEvaluations(result.data ?? [])
    } catch (error) {
      setEvaluationsError(getErrorMessage(error))
    } finally {
      setLoadingEvaluations(false)
    }
  }

  const loadMeetings = async () => {
    setLoadingMeetings(true)
    setMeetingsError(null)
    try {
      const result = await api.get<{ data: Meeting[] }>('/api/meetings?supervisorId=me')
      setMeetings(result.data ?? [])
    } catch (error) {
      setMeetingsError(getErrorMessage(error))
    } finally {
      setLoadingMeetings(false)
    }
  }

  const loadSkills = async () => {
    try {
      const result = await api.get<{ data: Skill[] }>('/api/admin/settings/skills')
      setSkills(result.data ?? [])
    } catch (error) {
      setMissionsError(getErrorMessage(error))
    }
  }

  const loadPendingInternOptions = async () => {
    try {
      const result = await api.get<{ data?: PendingInternOption[] }>('/api/interns?status=PENDING&limit=200')
      setPendingInternOptions(result.data ?? [])
    } catch {
      setPendingInternOptions([])
    }
  }

  useEffect(() => {
    void loadKpis()
    void loadInterns()
    void loadMissions()
    void loadDeliverables()
    void loadEvaluations()
    void loadMeetings()
    void loadSkills()
    void loadPendingInternOptions()
  }, [])

  useEffect(() => {
    if (!successToast) {
      return
    }

    const timer = window.setTimeout(() => {
      setSuccessToast(null)
    }, 3500)

    return () => {
      window.clearTimeout(timer)
    }
  }, [successToast])

  const handleCreateMission = async () => {
    const errors: Record<string, string> = {}
    if (!missionFormData.title.trim()) errors.title = t('dashboard.form.required')

    if (assignmentFormData.internId) {
      if (!assignmentFormData.startDate) {
        errors.startDate = t('dashboard.form.required')
      }

      if (!assignmentFormData.endDate) {
        errors.endDate = t('dashboard.form.required')
      }

      if (assignmentFormData.startDate && assignmentFormData.endDate && assignmentFormData.endDate < assignmentFormData.startDate) {
        errors.endDate = 'End date must be greater than or equal to start date.'
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    try {
      const mission = await api.post<{ id: string; title?: string }>('/api/missions', {
        ...missionFormData,
        deliverables: missionFormData.deliverables.split('\n').filter(Boolean),
      })

      if (assignmentFormData.internId) {
        await api.post('/api/stages/assign', {
          missionId: mission.id,
          internId: assignmentFormData.internId,
          startDate: new Date(assignmentFormData.startDate).toISOString(),
          endDate: new Date(assignmentFormData.endDate).toISOString(),
        })

        const internName = pendingInternOptions.find((intern) => intern.id === assignmentFormData.internId)?.fullName ?? 'Intern'
        const missionName = mission.title ?? missionFormData.title
        setSuccessToast(`Intern ${internName} has been activated and assigned to ${missionName}.`)
      }

      setIsCreateMissionModalOpen(false)
      setMissionFormData({ title: '', description: '', skills: [], tools: '', level: 'junior', deliverables: '' })
      setAssignmentFormData({ internId: '', startDate: '', endDate: '' })
      setFormErrors({})
      void loadMissions()
      void loadInterns()
      void loadKpis()
      void loadPendingInternOptions()
    } catch (error) {
      setFormErrors({ submit: getErrorMessage(error) })
    }
  }

  const handleAddMeeting = async () => {
    const errors: Record<string, string> = {}
    if (!meetingFormData.internId) errors.internId = t('dashboard.form.required')
    if (!meetingFormData.date) errors.date = t('dashboard.form.required')
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }

    try {
      await api.post('/api/meetings', {
        internId: meetingFormData.internId,
        date: meetingFormData.date,
        notes: meetingFormData.note,
      })
      setIsAddMeetingModalOpen(false)
      setMeetingFormData({ internId: '', date: '', note: '' })
      void loadMeetings()
    } catch (error) {
      setFormErrors({ submit: getErrorMessage(error) })
    }
  }

  const handleValidateDeliverable = async (action: 'accept' | 'reject') => {
    if (!selectedDeliverable) return
    if (action === 'reject' && !validationComment.trim()) {
      setFormErrors({ comment: t('dashboard.form.commentRequired') })
      return
    }

    try {
      await api.patch(`/api/deliverables/${selectedDeliverable.id}/validate`, {
        action,
        comment: validationComment,
      })
      setIsValidationModalOpen(false)
      setSelectedDeliverable(null)
      setValidationComment('')
      void loadDeliverables()
    } catch (error) {
      setFormErrors({ submit: getErrorMessage(error) })
    }
  }

  const handleSubmitEvaluation = async () => {
    if (!selectedEvaluation) return

    try {
      await api.post('/api/evaluations', {
        internId: selectedEvaluation.internId ?? selectedEvaluation.id,
        type: selectedEvaluation.type,
        scores: {
          technical: evaluationScores.technical,
          autonomy: evaluationScores.autonomy,
          communication: evaluationScores.communication,
          deadlineRespect: evaluationScores.deadlineRespect,
          deliverableQuality: evaluationScores.deliverableQuality,
        },
        comments: evaluationScores.comments,
      })
      setIsEvaluationModalOpen(false)
      setSelectedEvaluation(null)
      setEvaluationScores({
        technical: 0,
        autonomy: 0,
        communication: 0,
        deadlineRespect: 0,
        deliverableQuality: 0,
        comments: '',
      })
      void loadEvaluations()
    } catch (error) {
      setFormErrors({ submit: getErrorMessage(error) })
    }
  }

  const openValidationModal = (deliverable: Deliverable) => {
    setSelectedDeliverable(deliverable)
    setIsValidationModalOpen(true)
    setValidationComment('')
    setFormErrors({})
  }

  const openEvaluationModal = (evaluation: Evaluation) => {
    setSelectedEvaluation(evaluation)
    setIsEvaluationModalOpen(true)
    setEvaluationScores({
      technical: 0,
      autonomy: 0,
      communication: 0,
      deadlineRespect: 0,
      deliverableQuality: 0,
      comments: '',
    })
    setFormErrors({})
  }

  const closeCreateMissionModal = () => {
    setIsCreateMissionModalOpen(false)
    setFormErrors({})
  }

  const openInternProfile = (internId: string) => {
    navigate(`/interns/${internId}`)
  }

  const missionColumns = [
    { key: 'title', label: t('dashboard.table.title') },
    { key: 'internName', label: t('dashboard.table.intern') },
    { key: 'status', label: t('dashboard.table.status') },
    { key: 'deliverablesCount', label: t('dashboard.table.deliverables') },
  ]

  const meetingColumns = [
    { key: 'internName', label: t('dashboard.table.intern') },
    { key: 'date', label: t('dashboard.table.date') },
    { key: 'notes', label: t('dashboard.table.notes') },
  ]

  return {
    t,
    activeInternsCount,
    pendingValidationsCount,
    avgProgress,
    overdueCount,
    interns,
    missions,
    pendingDeliverables,
    pendingEvaluations,
    meetings,
    skills,
    pendingInternOptions,
    successToast,
    isCreateMissionModalOpen,
    setIsCreateMissionModalOpen,
    isAddMeetingModalOpen,
    setIsAddMeetingModalOpen,
    isEvaluationModalOpen,
    setIsEvaluationModalOpen,
    isValidationModalOpen,
    setIsValidationModalOpen,
    selectedDeliverable,
    selectedEvaluation,
    missionFormData,
    setMissionFormData,
    assignmentFormData,
    setAssignmentFormData,
    meetingFormData,
    setMeetingFormData,
    validationComment,
    setValidationComment,
    evaluationScores,
    setEvaluationScores,
    formErrors,
    loadingKpis,
    loadingInterns,
    loadingMissions,
    loadingDeliverables,
    loadingEvaluations,
    loadingMeetings,
    kpisError,
    internsError,
    missionsError,
    deliverablesError,
    evaluationsError,
    meetingsError,
    loadKpis,
    loadInterns,
    loadMissions,
    loadDeliverables,
    loadEvaluations,
    loadMeetings,
    handleCreateMission,
    handleAddMeeting,
    handleValidateDeliverable,
    handleSubmitEvaluation,
    openValidationModal,
    openEvaluationModal,
    closeCreateMissionModal,
    openInternProfile,
    missionColumns,
    meetingColumns,
  }
}

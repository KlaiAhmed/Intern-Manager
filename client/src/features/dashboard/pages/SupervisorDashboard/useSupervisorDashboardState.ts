import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../../../locales/I18nContext'
import { useDelaysAlerts } from '../../hooks/supervisor/useDelaysAlerts'
import { useEvaluations } from '../../hooks/supervisor/useEvaluations'
import { useInternProgress } from '../../hooks/supervisor/useInternProgress'
import { useMeetings } from '../../hooks/supervisor/useMeetings'
import { useSupervisorKpis } from '../../hooks/supervisor/useSupervisorKpis'
import { useSupervisorWorkload } from '../../hooks/supervisor/useSupervisorWorkload'
import { useValidationQueue } from '../../hooks/supervisor/useValidationQueue'
import type {
  SupervisorEvaluationDueItem,
  SupervisorEvaluationScores,
  SupervisorInternProgressItem,
  SupervisorMeetingForm,
  SupervisorValidationQueueItem,
} from '../../types/supervisorDashboard'

type ProgressTone = 'on-track' | 'at-risk' | 'late'
type DelaySeverityTone = 'info' | 'warning' | 'danger'

const initialEvaluationScores: SupervisorEvaluationScores = {
  technical: 5,
  autonomy: 5,
  communication: 5,
  deadlineRespect: 5,
  deliverableQuality: 5,
}

const initialMeetingForm: SupervisorMeetingForm = {
  internId: '',
  date: '',
  note: '',
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_.]+/g, '-')
}

function resolveProgressTone(item: SupervisorInternProgressItem): ProgressTone {
  if (item.isLate) {
    return 'late'
  }

  const normalizedStatus = normalizeToken(item.status)
  if (normalizedStatus.includes('late') || normalizedStatus.includes('overdue')) {
    return 'late'
  }

  if (
    normalizedStatus.includes('risk') ||
    normalizedStatus.includes('behind') ||
    normalizedStatus.includes('warning') ||
    item.progress < 35
  ) {
    return 'at-risk'
  }

  return 'on-track'
}

function severityWeight(rawSeverity: string): number {
  const normalizedSeverity = normalizeToken(rawSeverity)

  switch (normalizedSeverity) {
    case 'critical':
      return 4
    case 'high':
      return 3
    case 'moderate':
    case 'medium':
      return 2
    case 'low':
      return 1
    default:
      return 0
  }
}

function deduplicateInternOptions(
  progressItems: SupervisorInternProgressItem[],
  meetingInterns: Array<{ internId: string; internName: string }>
) {
  const byId = new Map<string, string>()

  for (const item of progressItems) {
    const internId = item.internId.trim()
    const fullName = item.fullName.trim()
    if (internId && fullName) {
      byId.set(internId, fullName)
    }
  }

  for (const item of meetingInterns) {
    const internId = item.internId.trim()
    const internName = item.internName.trim()
    if (internId && internName && !byId.has(internId)) {
      byId.set(internId, internName)
    }
  }

  return Array.from(byId.entries())
    .map(([id, fullName]) => ({ id, fullName }))
    .sort((left, right) => left.fullName.localeCompare(right.fullName))
}

export function useSupervisorDashboardState() {
  const { t } = useI18n()
  const navigate = useNavigate()

  const kpisState = useSupervisorKpis()
  const progressState = useInternProgress()
  const workloadState = useSupervisorWorkload()
  const delaysState = useDelaysAlerts()
  const queueState = useValidationQueue()
  const meetingsState = useMeetings()
  const evaluationsState = useEvaluations()

  const [meetingForm, setMeetingForm] = useState<SupervisorMeetingForm>(initialMeetingForm)
  const [meetingFormError, setMeetingFormError] = useState<string | null>(null)

  const [activeEvaluation, setActiveEvaluation] = useState<SupervisorEvaluationDueItem | null>(null)
  const [evaluationScores, setEvaluationScores] = useState<SupervisorEvaluationScores>(initialEvaluationScores)
  const [evaluationComment, setEvaluationComment] = useState('')

  const isRefreshing =
    kpisState.isLoading ||
    progressState.isLoading ||
    workloadState.isLoading ||
    delaysState.isLoading ||
    queueState.isLoading ||
    meetingsState.isLoading ||
    evaluationsState.isLoading

  const progressItems = useMemo(
    () =>
      progressState.items.map((item) => {
        const tone = resolveProgressTone(item)
        const statusLabel =
          tone === 'late'
            ? t('dashboard.supervisor.status.late')
            : tone === 'at-risk'
              ? t('dashboard.supervisor.status.atRisk')
              : t('dashboard.supervisor.status.onTrack')

        return {
          ...item,
          tone,
          statusLabel,
        }
      }),
    [progressState.items, t]
  )

  const delayAlerts = useMemo(
    () =>
      [...delaysState.alerts].sort((left, right) => {
        const severityDiff = severityWeight(right.severity) - severityWeight(left.severity)
        if (severityDiff !== 0) {
          return severityDiff
        }

        return right.daysOverdue - left.daysOverdue
      }),
    [delaysState.alerts]
  )

  const internOptions = useMemo(
    () =>
      deduplicateInternOptions(
        progressState.items,
        meetingsState.meetings.map((meeting) => ({
          internId: meeting.internId,
          internName: meeting.internName,
        }))
      ),
    [progressState.items, meetingsState.meetings]
  )

  const refreshAll = useCallback(async () => {
    await Promise.all([
      kpisState.refresh(),
      progressState.refresh(),
      workloadState.refresh(),
      delaysState.refresh(),
      queueState.refresh(),
      meetingsState.refresh(),
      evaluationsState.refresh(),
    ])
  }, [delaysState, evaluationsState, kpisState, meetingsState, progressState, queueState, workloadState])

  const openInternProfile = useCallback(
    (internId: string) => {
      navigate(`/dashboard/supervisor/interns/${internId}/journal`)
    },
    [navigate]
  )

  const resolveDelaySeverityTone = useCallback((severity: string): DelaySeverityTone => {
    const normalized = normalizeToken(severity)
    if (normalized === 'critical' || normalized === 'high') {
      return 'danger'
    }

    if (normalized === 'medium' || normalized === 'moderate') {
      return 'warning'
    }

    return 'info'
  }, [])

  const resolveDelaySeverityLabel = useCallback(
    (severity: string): string => {
      const normalized = normalizeToken(severity)
      switch (normalized) {
        case 'critical':
          return t('dashboard.supervisor.severity.critical')
        case 'high':
          return t('dashboard.supervisor.severity.high')
        case 'medium':
        case 'moderate':
          return t('dashboard.supervisor.severity.medium')
        case 'low':
          return t('dashboard.supervisor.severity.low')
        default:
          return t('dashboard.supervisor.severity.medium')
      }
    },
    [t]
  )

  const resolveEvaluationTypeLabel = useCallback(
    (rawType: string): string => {
      const normalized = normalizeToken(rawType)
      if (normalized.includes('mid')) {
        return t('dashboard.evaluation.midTerm')
      }

      return t('dashboard.evaluation.endOfInternship')
    },
    [t]
  )

  const handleQueueAccept = useCallback(
    async (item: SupervisorValidationQueueItem) => {
      await queueState.validateDeliverable(item, 'accept', '')
      kpisState.applyPendingDelta(-1)
    },
    [kpisState, queueState]
  )

  const handleQueueReject = useCallback(
    async (item: SupervisorValidationQueueItem, reason: string) => {
      await queueState.validateDeliverable(item, 'reject', reason)
      kpisState.applyPendingDelta(-1)
    },
    [kpisState, queueState]
  )

  const updateMeetingFormField = useCallback(
    (field: keyof SupervisorMeetingForm, value: string) => {
      setMeetingForm((previous) => ({
        ...previous,
        [field]: value,
      }))
    },
    []
  )

  const submitMeetingForm = useCallback(async () => {
    if (!meetingForm.internId.trim() || !meetingForm.date.trim()) {
      setMeetingFormError(t('dashboard.form.required'))
      return
    }

    setMeetingFormError(null)

    try {
      await meetingsState.scheduleMeeting(meetingForm)
      setMeetingForm(initialMeetingForm)
    } catch (error) {
      if (error instanceof Error && error.message.trim()) {
        setMeetingFormError(error.message)
        return
      }

      setMeetingFormError(t('dashboard.error.load'))
    }
  }, [meetingForm, meetingsState, t])

  const openEvaluationModal = useCallback((item: SupervisorEvaluationDueItem) => {
    setActiveEvaluation(item)
    setEvaluationScores(initialEvaluationScores)
    setEvaluationComment('')
  }, [])

  const closeEvaluationModal = useCallback(() => {
    setActiveEvaluation(null)
  }, [])

  const setEvaluationScore = useCallback((criterion: keyof SupervisorEvaluationScores, value: number) => {
    const normalizedScore = Math.max(0, Math.min(10, Math.round(value)))
    setEvaluationScores((previous) => ({
      ...previous,
      [criterion]: normalizedScore,
    }))
  }, [])

  const submitEvaluation = useCallback(async () => {
    if (!activeEvaluation) {
      return
    }

    await evaluationsState.submitEvaluation({
      internId: activeEvaluation.internId,
      type: activeEvaluation.type,
      scores: evaluationScores,
      comments: evaluationComment.trim(),
    })

    setActiveEvaluation(null)
    setEvaluationScores(initialEvaluationScores)
    setEvaluationComment('')
  }, [activeEvaluation, evaluationComment, evaluationScores, evaluationsState])

  return {
    t,
    refreshAll,
    isRefreshing,
    kpisState,
    progressState,
    progressItems,
    workloadState,
    delaysState,
    delayAlerts,
    queueState,
    meetingsState,
    evaluationsState,
    internOptions,
    meetingForm,
    meetingFormError,
    updateMeetingFormField,
    submitMeetingForm,
    openInternProfile,
    resolveDelaySeverityLabel,
    resolveDelaySeverityTone,
    resolveEvaluationTypeLabel,
    handleQueueAccept,
    handleQueueReject,
    activeEvaluation,
    evaluationScores,
    evaluationComment,
    setEvaluationComment,
    setEvaluationScore,
    openEvaluationModal,
    closeEvaluationModal,
    submitEvaluation,
  }
}
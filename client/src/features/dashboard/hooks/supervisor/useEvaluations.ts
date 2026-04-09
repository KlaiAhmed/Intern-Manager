import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { useDashboardApi } from '../useDashboardApi'
import type {
  SupervisorEvaluationDueItem,
  SupervisorEvaluationScores,
  SupervisorEvaluationStatus,
  SupervisorEvaluationCompletedItem,
} from '../../types/supervisorDashboard'
import { toErrorMessage, toNumber, toStringValue } from './utils'

interface EvaluationStatusApiDueItem {
  evaluationId?: unknown
  internId?: unknown
  internName?: unknown
  type?: unknown
}

interface EvaluationStatusApiCompletedItem {
  evaluationId?: unknown
  internId?: unknown
  internName?: unknown
  type?: unknown
  averageScore?: unknown
  submittedAt?: unknown
}

interface EvaluationStatusApiResponse {
  due?: EvaluationStatusApiDueItem[]
  completed?: EvaluationStatusApiCompletedItem[]
}

interface SubmitEvaluationPayload {
  internId: string
  type: string
  scores: SupervisorEvaluationScores
  comments: string
}

function normalizeEvaluationType(rawValue: string): string {
  const normalized = rawValue.trim().toLowerCase().replace(/[_\s]/g, '-')

  if (normalized.includes('mid')) {
    return 'mid-term'
  }

  if (normalized.includes('end')) {
    return 'end'
  }

  return normalized
}

export function useEvaluations() {
  const { t } = useI18n()
  const { get, post } = useDashboardApi()

  const [status, setStatus] = useState<SupervisorEvaluationStatus>({ due: [], completed: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await get<EvaluationStatusApiResponse>('/api/evaluations/supervisor/me/status')

      const dueItems: SupervisorEvaluationDueItem[] = (response.due ?? [])
        .map((item) => ({
          evaluationId: toStringValue(item.evaluationId),
          internId: toStringValue(item.internId),
          internName: toStringValue(item.internName),
          type: normalizeEvaluationType(toStringValue(item.type, 'mid-term')),
        }))
        .filter((item) => item.evaluationId.length > 0)

      const completedItems: SupervisorEvaluationCompletedItem[] = (response.completed ?? [])
        .map((item) => ({
          evaluationId: toStringValue(item.evaluationId),
          internId: toStringValue(item.internId),
          internName: toStringValue(item.internName),
          type: normalizeEvaluationType(toStringValue(item.type, 'mid-term')),
          averageScore: Number(toNumber(item.averageScore, 0).toFixed(1)),
          submittedAt: toStringValue(item.submittedAt),
        }))
        .filter((item) => item.evaluationId.length > 0)

      setStatus({
        due: dueItems,
        completed: completedItems,
      })
    } catch (requestError) {
      setError(toErrorMessage(requestError, t('dashboard.error.load')))
    } finally {
      setIsLoading(false)
    }
  }, [get, t])

  const submitEvaluation = useCallback(
    async (payload: SubmitEvaluationPayload) => {
      const normalizedType = normalizeEvaluationType(payload.type)
      const apiType = normalizedType === 'mid-term' ? 'mid-term' : 'end'

      setIsSubmitting(true)
      setSubmitError(null)

      try {
        await post('/api/evaluations', {
          internId: payload.internId,
          type: apiType,
          criteria: payload.scores,
          comments: payload.comments,
        })

        await refresh()
      } catch (requestError) {
        const message = toErrorMessage(requestError, t('dashboard.error.load'))
        setSubmitError(message)
        throw new Error(message)
      } finally {
        setIsSubmitting(false)
      }
    },
    [post, refresh, t]
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    status,
    isLoading,
    error,
    isSubmitting,
    submitError,
    refresh,
    submitEvaluation,
  }
}

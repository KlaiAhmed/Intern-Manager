import { useCallback, useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { useDashboardApi } from '../useDashboardApi'
import { toErrorMessage } from './utils'

interface DeliverableCreationApiResponse {
  id?: unknown
  internId?: unknown
  title?: unknown
  dueDate?: unknown
  status?: unknown
  progress?: unknown
}

export function useDeliverableAssignment() {
  const { t } = useI18n()
  const { post } = useDashboardApi()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const assignDeliverable = useCallback(
    async (form: {
      internId: string
      missionId: string
      title: string
      description: string
      dueDate: string
    }): Promise<DeliverableCreationApiResponse> => {
      const internId = form.internId.trim()
      if (!internId) {
        const message = t('dashboard.form.required')
        setSubmitError(message)
        throw new Error(message)
      }

      const missionId = form.missionId.trim()
      if (!missionId) {
        const message = t('dashboard.form.required')
        setSubmitError(message)
        throw new Error(message)
      }

      const title = form.title.trim()
      if (!title) {
        const message = t('dashboard.form.required')
        setSubmitError(message)
        throw new Error(message)
      }

      const description = form.description.trim()
      const dueDate = form.dueDate.trim()

      let normalizedDueDate: string | null = null
      if (dueDate) {
        const parsedDate = new Date(dueDate)
        if (Number.isNaN(parsedDate.getTime())) {
          const message = t('dashboard.error.load')
          setSubmitError(message)
          throw new Error(message)
        }
        normalizedDueDate = parsedDate.toISOString()
      }

      setIsSubmitting(true)
      setSubmitError(null)

      try {
        const response = await post<DeliverableCreationApiResponse>('/api/deliverables', {
          internId,
          missionId,
          title,
          description,
          dueDate: normalizedDueDate,
        })

        return response
      } catch (requestError) {
        const message = toErrorMessage(requestError, t('dashboard.error.load'))
        setSubmitError(message)
        throw new Error(message)
      } finally {
        setIsSubmitting(false)
      }
    },
    [post, t]
  )

  return {
    isSubmitting,
    submitError,
    assignDeliverable,
  }
}
import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { useDashboardApi } from '../useDashboardApi'
import type { PagedResponse, SupervisorValidationQueueItem } from '../../types/supervisorDashboard'
import { toErrorMessage, toNumber, toStringValue } from './utils'

type ValidationAction = 'accept' | 'reject'

interface ValidationQueueApiItem {
  id?: unknown
  title?: unknown
  internId?: unknown
  internName?: unknown
  submittedDate?: unknown
  dueDate?: unknown
  status?: unknown
  version?: unknown
  fileUrl?: unknown
}

interface ValidationActionApiResponse {
  id?: unknown
  status?: unknown
}

function sortOldestFirst(items: SupervisorValidationQueueItem[]): SupervisorValidationQueueItem[] {
  const sortable = [...items]
  sortable.sort((left, right) => {
    const leftTimestamp = left.submittedDate ? Date.parse(left.submittedDate) : Number.MAX_SAFE_INTEGER
    const rightTimestamp = right.submittedDate ? Date.parse(right.submittedDate) : Number.MAX_SAFE_INTEGER
    return leftTimestamp - rightTimestamp
  })

  return sortable
}

export function useValidationQueue() {
  const { t } = useI18n()
  const { get, patch } = useDashboardApi()

  const [items, setItems] = useState<SupervisorValidationQueueItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [submittingItemId, setSubmittingItemId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await get<PagedResponse<ValidationQueueApiItem>>(
        '/api/deliverables?status=submitted&supervisorId=me&page=1&limit=100'
      )

      const mappedItems = sortOldestFirst(
        (response.data ?? [])
          .map((item) => ({
            id: toStringValue(item.id),
            title: toStringValue(item.title),
            internId: toStringValue(item.internId) || null,
            internName: toStringValue(item.internName),
            submittedDate: toStringValue(item.submittedDate) || null,
            dueDate: toStringValue(item.dueDate) || null,
            status: toStringValue(item.status, 'submitted'),
            version: Math.max(1, Math.round(toNumber(item.version, 1))),
            fileUrl: toStringValue(item.fileUrl, '#'),
          }))
          .filter((item) => item.id.length > 0)
      )

      setItems(mappedItems)
      setTotal(Math.max(mappedItems.length, Math.round(toNumber(response.total))))
    } catch (requestError) {
      setError(toErrorMessage(requestError, t('dashboard.error.load')))
    } finally {
      setIsLoading(false)
    }
  }, [get, t])

  const validateDeliverable = useCallback(
    async (item: SupervisorValidationQueueItem, action: ValidationAction, comment: string) => {
      const normalizedComment = comment.trim()
      if (action === 'reject' && normalizedComment.length === 0) {
        const message = t('dashboard.form.commentRequired')
        setActionError(message)
        throw new Error(message)
      }

      setSubmittingItemId(item.id)
      setActionError(null)

      try {
        const response = await patch<ValidationActionApiResponse>(`/api/deliverables/${item.id}/validate`, {
          action,
          comment: normalizedComment.length > 0 ? normalizedComment : null,
        })

        setItems((previousItems) => previousItems.filter((queuedItem) => queuedItem.id !== item.id))
        setTotal((previousTotal) => (previousTotal > 0 ? previousTotal - 1 : 0))

        return {
          id: toStringValue(response.id, item.id),
          status: toStringValue(response.status, action === 'accept' ? 'accepted' : 'rejected'),
        }
      } catch (requestError) {
        const message = toErrorMessage(requestError, t('dashboard.error.load'))
        setActionError(message)
        throw new Error(message)
      } finally {
        setSubmittingItemId(null)
      }
    },
    [patch, t]
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    items,
    total,
    isLoading,
    error,
    actionError,
    submittingItemId,
    refresh,
    validateDeliverable,
  }
}

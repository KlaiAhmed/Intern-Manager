import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { isDashboardApiError, useDashboardApi } from '../useDashboardApi'
import type { PagedResponse, SupervisorValidationQueueItem } from '../../types/supervisorDashboard'
import { toErrorMessage, toNumber, toStringValue } from './utils'

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
  rowVersion?: unknown
  rawProgress?: unknown
  tasks?: unknown
}

interface ValidationQueueTaskApiItem {
  id?: unknown
  title?: unknown
  status?: unknown
  rowVersion?: unknown
}

interface ValidationActionApiResponse {
  id?: unknown
  status?: unknown
  rowVersion?: unknown
  rawProgress?: unknown
}

function isTaskApiItem(value: unknown): value is ValidationQueueTaskApiItem {
  return typeof value === 'object' && value !== null
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
  const { get, post } = useDashboardApi()

  const [items, setItems] = useState<SupervisorValidationQueueItem[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [submittingItemId, setSubmittingItemId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await get<PagedResponse<ValidationQueueApiItem>>(
        '/api/deliverables?status=awaiting_review&supervisorId=me&page=1&limit=100'
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
            rowVersion: Math.max(1, Math.round(toNumber(item.rowVersion, 1))),
            rawProgress: Math.max(0, Math.min(100, toNumber(item.rawProgress, 0))),
            tasks: Array.isArray(item.tasks)
              ? item.tasks
                  .filter(isTaskApiItem)
                  .map((task) => ({
                    id: toStringValue(task.id),
                    title: toStringValue(task.title),
                    status: toStringValue(task.status),
                    rowVersion: Math.max(1, Math.round(toNumber(task.rowVersion, 1))),
                  }))
                  .filter((task) => task.id.length > 0)
              : [],
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

  const approveDeliverable = useCallback(
    async (deliverableId: string, rowVersion: number) => {
      setSubmittingItemId(deliverableId)
      setActionError(null)
      setActionNotice(null)

      try {
        const response = await post<ValidationActionApiResponse>(`/api/deliverables/${deliverableId}/approve`, {
          rowVersion,
        })

        setItems((previousItems) => previousItems.filter((queuedItem) => queuedItem.id !== deliverableId))
        setTotal((previousTotal) => (previousTotal > 0 ? previousTotal - 1 : 0))

        return {
          id: toStringValue(response.id, deliverableId),
          status: toStringValue(response.status, 'approved'),
        }
      } catch (requestError) {
        if (isDashboardApiError(requestError) && requestError.status === 409) {
          const message = t('dashboard.supervisor.queue.conflictRefreshing')
          setActionNotice(message)
          await refresh()
          throw new Error(message)
        }

        const message = toErrorMessage(requestError, t('dashboard.error.load'))
        setActionError(message)
        throw new Error(message)
      } finally {
        setSubmittingItemId(null)
      }
    },
    [post, refresh, t]
  )

  const rejectDeliverable = useCallback(
    async (deliverableId: string, reason: string, taskIdsToReopen: string[], rowVersion: number) => {
      const normalizedReason = reason.trim()
      if (normalizedReason.length < 10 || normalizedReason.length > 1000) {
        const message = t('dashboard.supervisor.queue.rejectReasonLength')
        setActionError(message)
        throw new Error(message)
      }

      setSubmittingItemId(deliverableId)
      setActionError(null)
      setActionNotice(null)

      try {
        const response = await post<ValidationActionApiResponse>(`/api/deliverables/${deliverableId}/reject`, {
          reason: normalizedReason,
          taskIdsToReopen,
          rowVersion,
        })

        setItems((previousItems) => previousItems.filter((queuedItem) => queuedItem.id !== deliverableId))
        setTotal((previousTotal) => (previousTotal > 0 ? previousTotal - 1 : 0))

        return {
          id: toStringValue(response.id, deliverableId),
          status: toStringValue(response.status, 'in_progress'),
        }
      } catch (requestError) {
        if (isDashboardApiError(requestError) && requestError.status === 409) {
          const message = t('dashboard.supervisor.queue.conflictRefreshing')
          setActionNotice(message)
          await refresh()
          throw new Error(message)
        }

        const message = toErrorMessage(requestError, t('dashboard.error.load'))
        setActionError(message)
        throw new Error(message)
      } finally {
        setSubmittingItemId(null)
      }
    },
    [post, refresh, t]
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
    actionNotice,
    submittingItemId,
    refresh,
    approveDeliverable,
    rejectDeliverable,
  }
}

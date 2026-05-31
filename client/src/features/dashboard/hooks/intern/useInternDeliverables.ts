import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { internDashboardApi } from '../../api/internDashboardApi'
import type { SubmitDeliverableVersionRequest } from '../../types/intern.types'
import type { UploadProgress } from '../../../../lib/uploadWithProgress'
import { internDashboardQueryKeys } from './internDashboardQueryKeys'
import { internDashboardStaleTimeMs, type InternQueryHookOptions } from './internHookOptions'

interface SubmitDeliverableFileVariables {
  deliverableId: string
  file: File
}

export function useInternDeliverables(options: InternQueryHookOptions = {}) {
  const queryClient = useQueryClient()
  const enabled = options.enabled ?? true
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)

  const deliverablesQuery = useQuery({
    queryKey: internDashboardQueryKeys.deliverables(),
    queryFn: () => internDashboardApi.getDeliverables({ page: 1, limit: 100 }),
    enabled,
    staleTime: internDashboardStaleTimeMs,
  })

  const invalidateDeliverableWork = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: internDashboardQueryKeys.deliverables() }),
      queryClient.invalidateQueries({ queryKey: internDashboardQueryKeys.tasks() }),
    ])
  }

  const submitFileMutation = useMutation({
    mutationFn: ({ deliverableId, file }: SubmitDeliverableFileVariables) => {
      setUploadProgress(null)
      return internDashboardApi.submitDeliverableFile(deliverableId, file, {
        onProgress: setUploadProgress,
      })
    },
    onSuccess: invalidateDeliverableWork,
  })

  const submitVersionMutation = useMutation({
    mutationFn: (request: SubmitDeliverableVersionRequest) => {
      setUploadProgress(null)
      return internDashboardApi.submitDeliverableVersion(request, {
        onProgress: setUploadProgress,
      })
    },
    onSuccess: async (response) => {
      await Promise.all([
        invalidateDeliverableWork(),
        queryClient.invalidateQueries({
          queryKey: internDashboardQueryKeys.deliverableVersions(response.deliverableId),
        }),
      ])
    },
  })

  return {
    deliverables: deliverablesQuery.data?.data ?? [],
    total: deliverablesQuery.data?.total ?? 0,
    uploadProgress,
    deliverablesQuery,
    submitFileMutation,
    submitVersionMutation,
    submitFile: submitFileMutation.mutateAsync,
    submitVersion: submitVersionMutation.mutateAsync,
    isLoading: deliverablesQuery.isLoading,
    isFetching: deliverablesQuery.isFetching,
    isUploading: submitFileMutation.isPending || submitVersionMutation.isPending,
    error: deliverablesQuery.error ?? submitFileMutation.error ?? submitVersionMutation.error,
    refetch: deliverablesQuery.refetch,
  }
}

export function useInternDeliverableVersions(
  deliverableId: string | null | undefined,
  options: InternQueryHookOptions = {},
) {
  const enabled = (options.enabled ?? true) && Boolean(deliverableId)

  return useQuery({
    queryKey: internDashboardQueryKeys.deliverableVersions(deliverableId),
    queryFn: () => internDashboardApi.getDeliverableVersions(deliverableId ?? ''),
    enabled,
    staleTime: internDashboardStaleTimeMs,
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { internDashboardApi } from '../../api/internDashboardApi'
import type { CreateJournalEntryRequest } from '../../types/intern.types'
import { internDashboardQueryKeys } from './internDashboardQueryKeys'
import { internDashboardStaleTimeMs, type InternQueryHookOptions } from './internHookOptions'

interface InternJournalHookOptions extends InternQueryHookOptions {
  limit?: number
}

export function useInternJournal(options: InternJournalHookOptions = {}) {
  const queryClient = useQueryClient()
  const enabled = options.enabled ?? true
  const limit = options.limit ?? 10

  const journalQuery = useQuery({
    queryKey: [...internDashboardQueryKeys.journal(), { limit }] as const,
    queryFn: () => internDashboardApi.getJournalEntries(limit),
    enabled,
    staleTime: internDashboardStaleTimeMs,
  })

  const createEntryMutation = useMutation({
    mutationFn: (request: CreateJournalEntryRequest) => internDashboardApi.createJournalEntry(request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: internDashboardQueryKeys.journal() })
    },
  })

  return {
    entries: journalQuery.data?.data ?? [],
    journalQuery,
    createEntryMutation,
    addEntry: createEntryMutation.mutateAsync,
    isLoading: journalQuery.isLoading,
    isFetching: journalQuery.isFetching,
    error: journalQuery.error ?? createEntryMutation.error,
    refetch: journalQuery.refetch,
  }
}

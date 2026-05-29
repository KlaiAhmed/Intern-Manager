import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { internDashboardApi } from '../../api/internDashboardApi'
import type {
  ReplaceInternSkillsRequest,
  UpdateInternProfileRequest,
} from '../../types/intern.types'
import type { UploadProgress } from '../../../../lib/uploadWithProgress'
import { internDashboardQueryKeys } from './internDashboardQueryKeys'
import { internDashboardStaleTimeMs, type InternQueryHookOptions } from './internHookOptions'

export function useInternProfile(options: InternQueryHookOptions = {}) {
  const queryClient = useQueryClient()
  const enabled = options.enabled ?? true
  const [cvUploadProgress, setCvUploadProgress] = useState<UploadProgress | null>(null)

  const profileQuery = useQuery({
    queryKey: internDashboardQueryKeys.profile(),
    queryFn: internDashboardApi.getProfile,
    enabled,
    staleTime: internDashboardStaleTimeMs,
  })

  const schoolsQuery = useQuery({
    queryKey: internDashboardQueryKeys.schools(),
    queryFn: internDashboardApi.getSchools,
    enabled,
    staleTime: internDashboardStaleTimeMs,
  })

  const skillsQuery = useQuery({
    queryKey: internDashboardQueryKeys.skills(),
    queryFn: internDashboardApi.getSkills,
    enabled,
    retry: false,
    staleTime: internDashboardStaleTimeMs,
  })

  const invalidateProfile = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: internDashboardQueryKeys.profile() }),
      queryClient.invalidateQueries({ queryKey: internDashboardQueryKeys.statuses() }),
    ])
  }

  const updateProfileMutation = useMutation({
    mutationFn: (request: UpdateInternProfileRequest) => internDashboardApi.updateProfile(request),
    onSuccess: invalidateProfile,
  })

  const replaceSkillsMutation = useMutation({
    mutationFn: (request: ReplaceInternSkillsRequest) => internDashboardApi.replaceSkills(request),
    onSuccess: invalidateProfile,
  })

  const uploadCvMutation = useMutation({
    mutationFn: (file: File) => {
      setCvUploadProgress(null)
      return internDashboardApi.uploadCv(file, {
        onProgress: setCvUploadProgress,
      })
    },
    onSuccess: invalidateProfile,
  })

  return {
    profile: profileQuery.data ?? null,
    schools: schoolsQuery.data ?? [],
    skillOptions: (() => {
      const raw = skillsQuery.data
      if (Array.isArray(raw)) return raw
      if (raw && typeof raw === 'object' && 'data' in raw && Array.isArray(raw.data)) return raw.data
      return []
    })(),
    skillsQuery,
    skillsError: skillsQuery.error,
    cvUploadProgress,
    profileQuery,
    schoolsQuery,
    updateProfileMutation,
    replaceSkillsMutation,
    uploadCvMutation,
    updateProfile: updateProfileMutation.mutateAsync,
    replaceSkills: replaceSkillsMutation.mutateAsync,
    uploadCv: uploadCvMutation.mutateAsync,
    isLoading: profileQuery.isLoading || schoolsQuery.isLoading,
    isFetching: profileQuery.isFetching || schoolsQuery.isFetching || skillsQuery.isFetching,
    isUploadingCv: uploadCvMutation.isPending,
    error: profileQuery.error ?? schoolsQuery.error ?? updateProfileMutation.error ?? replaceSkillsMutation.error ?? uploadCvMutation.error,
    refetch: async () => {
      await Promise.all([
        profileQuery.refetch(),
        schoolsQuery.refetch(),
        skillsQuery.refetch(),
      ])
    },
  }
}

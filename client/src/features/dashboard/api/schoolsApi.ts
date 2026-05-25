import { useCallback, useMemo } from 'react'

import { useDashboardApi } from '../hooks/useDashboardApi'

export interface School {
  id: string
  name: string
}

export function useSchoolsApi() {
  const api = useDashboardApi()

  const getSchools = useCallback(async (): Promise<School[]> => {
    const result = await api.get<School[]>('/api/intern/me/profile/schools')
    return result
  }, [api])

  return useMemo(
    () => ({
      getSchools,
    }),
    [getSchools],
  )
}

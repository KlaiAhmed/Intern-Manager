import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { useDashboardApi } from '../../hooks/useDashboardApi'
import type {
  BiActionQueueResponse,
  BiDeliverableStatsResponse,
  BiDemographicsResponse,
  BiEvaluationStatsResponse,
  BiInternFunnelResponse,
  BiKpiResponse,
  BiMissionStatsResponse,
  BiSectionData,
  BiSupervisorWorkloadResponse,
  BiSystemHealthResponse,
} from '../types/biDashboard'
import { toDashboardErrorMessage } from '../utils/errorMessage'

type BiSectionState<T> = Omit<BiSectionData<T>, 'refetch'>

const createInitialSectionState = <T,>(): BiSectionState<T> => ({
  data: null,
  loading: true,
  error: null,
})

export function useBiDashboardData() {
  const api = useDashboardApi()

  const [kpi, setKpi] = useState<BiSectionState<BiKpiResponse>>(createInitialSectionState)
  const [funnel, setFunnel] = useState<BiSectionState<BiInternFunnelResponse>>(createInitialSectionState)
  const [missionStats, setMissionStats] = useState<BiSectionState<BiMissionStatsResponse>>(createInitialSectionState)
  const [evaluationStats, setEvaluationStats] = useState<BiSectionState<BiEvaluationStatsResponse>>(createInitialSectionState)
  const [demographics, setDemographics] = useState<BiSectionState<BiDemographicsResponse>>(createInitialSectionState)
  const [supervisorWorkload, setSupervisorWorkload] = useState<BiSectionState<BiSupervisorWorkloadResponse>>(createInitialSectionState)
  const [deliverableStats, setDeliverableStats] = useState<BiSectionState<BiDeliverableStatsResponse>>(createInitialSectionState)
  const [systemHealth, setSystemHealth] = useState<BiSectionState<BiSystemHealthResponse>>(createInitialSectionState)
  const [actionQueue, setActionQueue] = useState<BiSectionState<BiActionQueueResponse>>(createInitialSectionState)

  const loadSection = useCallback(async <T,>(
    path: string,
    setSection: Dispatch<SetStateAction<BiSectionState<T>>>,
  ) => {
    setSection((current) => ({ ...current, loading: true, error: null }))

    try {
      const data = await api.get<T>(path)
      setSection({ data, loading: false, error: null })
    } catch (requestError) {
      setSection({
        data: null,
        loading: false,
        error: toDashboardErrorMessage(requestError),
      })
    }
  }, [api])

  const fetchKpi = useCallback(() => loadSection<BiKpiResponse>('/api/stats/bi/kpi', setKpi), [loadSection])
  const fetchFunnel = useCallback(() => loadSection<BiInternFunnelResponse>('/api/stats/bi/intern-funnel', setFunnel), [loadSection])
  const fetchMissionStats = useCallback(() => loadSection<BiMissionStatsResponse>('/api/stats/bi/mission-stats', setMissionStats), [loadSection])
  const fetchEvaluationStats = useCallback(() => loadSection<BiEvaluationStatsResponse>('/api/stats/bi/evaluation-stats', setEvaluationStats), [loadSection])
  const fetchDemographics = useCallback(() => loadSection<BiDemographicsResponse>('/api/stats/bi/demographics', setDemographics), [loadSection])
  const fetchSupervisorWorkload = useCallback(() => loadSection<BiSupervisorWorkloadResponse>('/api/stats/bi/supervisor-workload', setSupervisorWorkload), [loadSection])
  const fetchDeliverableStats = useCallback(() => loadSection<BiDeliverableStatsResponse>('/api/stats/bi/deliverable-stats', setDeliverableStats), [loadSection])
  const fetchSystemHealth = useCallback(() => loadSection<BiSystemHealthResponse>('/api/stats/bi/system-health', setSystemHealth), [loadSection])
  const fetchActionQueue = useCallback(() => loadSection<BiActionQueueResponse>('/api/stats/bi/action-queue', setActionQueue), [loadSection])

  const fetchAll = useCallback(async () => {
    await Promise.allSettled([
      fetchKpi(),
      fetchFunnel(),
      fetchMissionStats(),
      fetchEvaluationStats(),
      fetchDemographics(),
      fetchSupervisorWorkload(),
      fetchDeliverableStats(),
      fetchSystemHealth(),
      fetchActionQueue(),
    ])
  }, [
    fetchActionQueue,
    fetchDeliverableStats,
    fetchDemographics,
    fetchEvaluationStats,
    fetchFunnel,
    fetchKpi,
    fetchMissionStats,
    fetchSupervisorWorkload,
    fetchSystemHealth,
  ])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const refetchKpi = useCallback(() => { void fetchKpi() }, [fetchKpi])
  const refetchFunnel = useCallback(() => { void fetchFunnel() }, [fetchFunnel])
  const refetchMissionStats = useCallback(() => { void fetchMissionStats() }, [fetchMissionStats])
  const refetchEvaluationStats = useCallback(() => { void fetchEvaluationStats() }, [fetchEvaluationStats])
  const refetchDemographics = useCallback(() => { void fetchDemographics() }, [fetchDemographics])
  const refetchSupervisorWorkload = useCallback(() => { void fetchSupervisorWorkload() }, [fetchSupervisorWorkload])
  const refetchDeliverableStats = useCallback(() => { void fetchDeliverableStats() }, [fetchDeliverableStats])
  const refetchSystemHealth = useCallback(() => { void fetchSystemHealth() }, [fetchSystemHealth])
  const refetchActionQueue = useCallback(() => { void fetchActionQueue() }, [fetchActionQueue])
  const refetchAll = useCallback(() => { void fetchAll() }, [fetchAll])

  return {
    kpi: { ...kpi, refetch: refetchKpi },
    funnel: { ...funnel, refetch: refetchFunnel },
    missionStats: { ...missionStats, refetch: refetchMissionStats },
    evaluationStats: { ...evaluationStats, refetch: refetchEvaluationStats },
    demographics: { ...demographics, refetch: refetchDemographics },
    supervisorWorkload: { ...supervisorWorkload, refetch: refetchSupervisorWorkload },
    deliverableStats: { ...deliverableStats, refetch: refetchDeliverableStats },
    systemHealth: { ...systemHealth, refetch: refetchSystemHealth },
    actionQueue: { ...actionQueue, refetch: refetchActionQueue },
    refetchAll,
  }
}

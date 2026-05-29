import { useCallback, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
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

export const biSectionKeys = [
  'kpi',
  'funnel',
  'missionStats',
  'evaluationStats',
  'demographics',
  'supervisorWorkload',
  'deliverableStats',
  'systemHealth',
  'actionQueue',
] as const

export type BiSectionKey = typeof biSectionKeys[number]

type BiSectionState<T> = Omit<BiSectionData<T>, 'refetch'>

type UseBiDashboardOptions = {
  initialSections?: BiSectionKey[]
}

const createInitialSectionState = <T,>(loading = false): BiSectionState<T> => ({
  data: null,
  loading,
  error: null,
})

export function useBiDashboardData(options: UseBiDashboardOptions = {}) {
  const api = useDashboardApi()

  const initialSections = options.initialSections ?? []
  const initialSectionSet = useMemo(() => new Set(initialSections), [initialSections])

  const [kpi, setKpi] = useState<BiSectionState<BiKpiResponse>>(
    () => createInitialSectionState(initialSectionSet.has('kpi')),
  )
  const [funnel, setFunnel] = useState<BiSectionState<BiInternFunnelResponse>>(
    () => createInitialSectionState(initialSectionSet.has('funnel')),
  )
  const [missionStats, setMissionStats] = useState<BiSectionState<BiMissionStatsResponse>>(
    () => createInitialSectionState(initialSectionSet.has('missionStats')),
  )
  const [evaluationStats, setEvaluationStats] = useState<BiSectionState<BiEvaluationStatsResponse>>(
    () => createInitialSectionState(initialSectionSet.has('evaluationStats')),
  )
  const [demographics, setDemographics] = useState<BiSectionState<BiDemographicsResponse>>(
    () => createInitialSectionState(initialSectionSet.has('demographics')),
  )
  const [supervisorWorkload, setSupervisorWorkload] = useState<BiSectionState<BiSupervisorWorkloadResponse>>(
    () => createInitialSectionState(initialSectionSet.has('supervisorWorkload')),
  )
  const [deliverableStats, setDeliverableStats] = useState<BiSectionState<BiDeliverableStatsResponse>>(
    () => createInitialSectionState(initialSectionSet.has('deliverableStats')),
  )
  const [systemHealth, setSystemHealth] = useState<BiSectionState<BiSystemHealthResponse>>(
    () => createInitialSectionState(initialSectionSet.has('systemHealth')),
  )
  const [actionQueue, setActionQueue] = useState<BiSectionState<BiActionQueueResponse>>(
    () => createInitialSectionState(initialSectionSet.has('actionQueue')),
  )

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

  const sectionLoaders = useMemo(() => ({
    kpi: () => loadSection<BiKpiResponse>('/api/stats/bi/kpi', setKpi),
    funnel: () => loadSection<BiInternFunnelResponse>('/api/stats/bi/intern-funnel', setFunnel),
    missionStats: () => loadSection<BiMissionStatsResponse>('/api/stats/bi/mission-stats', setMissionStats),
    evaluationStats: () => loadSection<BiEvaluationStatsResponse>('/api/stats/bi/evaluation-stats', setEvaluationStats),
    demographics: () => loadSection<BiDemographicsResponse>('/api/stats/bi/demographics', setDemographics),
    supervisorWorkload: () => loadSection<BiSupervisorWorkloadResponse>('/api/stats/bi/supervisor-workload', setSupervisorWorkload),
    deliverableStats: () => loadSection<BiDeliverableStatsResponse>('/api/stats/bi/deliverable-stats', setDeliverableStats),
    systemHealth: () => loadSection<BiSystemHealthResponse>('/api/stats/bi/system-health', setSystemHealth),
    actionQueue: () => loadSection<BiActionQueueResponse>('/api/stats/bi/action-queue', setActionQueue),
  }) as const, [loadSection])

  const inFlightRef = useRef<Partial<Record<BiSectionKey, Promise<void>>>>({})
  const requestedRef = useRef<Set<BiSectionKey>>(new Set())

  const requestSection = useCallback(async (key: BiSectionKey, options?: { force?: boolean }) => {
    const isForced = options?.force ?? false
    const inFlight = inFlightRef.current[key]

    if (!isForced) {
      if (inFlight) {
        return inFlight
      }

      if (requestedRef.current.has(key)) {
        return Promise.resolve()
      }
    }

    requestedRef.current.add(key)
    const promise = sectionLoaders[key]().finally(() => {
      delete inFlightRef.current[key]
    })
    inFlightRef.current[key] = promise
    return promise
  }, [sectionLoaders])

  const requestSections = useCallback(async (keys: readonly BiSectionKey[], options?: { force?: boolean }) => {
    await Promise.allSettled(keys.map((key) => requestSection(key, options)))
  }, [requestSection])

  const refetchKpi = useCallback(() => { void requestSection('kpi', { force: true }) }, [requestSection])
  const refetchFunnel = useCallback(() => { void requestSection('funnel', { force: true }) }, [requestSection])
  const refetchMissionStats = useCallback(() => { void requestSection('missionStats', { force: true }) }, [requestSection])
  const refetchEvaluationStats = useCallback(() => { void requestSection('evaluationStats', { force: true }) }, [requestSection])
  const refetchDemographics = useCallback(() => { void requestSection('demographics', { force: true }) }, [requestSection])
  const refetchSupervisorWorkload = useCallback(() => { void requestSection('supervisorWorkload', { force: true }) }, [requestSection])
  const refetchDeliverableStats = useCallback(() => { void requestSection('deliverableStats', { force: true }) }, [requestSection])
  const refetchSystemHealth = useCallback(() => { void requestSection('systemHealth', { force: true }) }, [requestSection])
  const refetchActionQueue = useCallback(() => { void requestSection('actionQueue', { force: true }) }, [requestSection])
  const refetchAll = useCallback(() => requestSections(biSectionKeys, { force: true }), [requestSections])

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
    requestSection,
  }
}

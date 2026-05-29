import {
  internDashboardTabs,
  type InternDashboardTab,
  type InternLifecycleStatus,
  type InternTabVisibilityMap,
} from '../../types/intern.types'
import type { MissionCardConfig } from '../../types/missionFeatureFlags'

const alwaysVisibleTabs: InternDashboardTab[] = ['overview', 'profile']

function createVisibilityMap(isVisible: boolean, isLoading: boolean): InternTabVisibilityMap {
  return Object.fromEntries(
    internDashboardTabs.map((tab) => [
      tab,
      {
        isVisible,
        isLoading,
      },
    ]),
  ) as InternTabVisibilityMap
}

function applyStaticTabs(map: InternTabVisibilityMap): void {
  for (const tab of alwaysVisibleTabs) {
    map[tab] = {
      isVisible: true,
      isLoading: false,
    }
  }
}

export interface ComputeInternTabVisibilityOptions {
  lifecycleStatus: InternLifecycleStatus | null
  missionFlags: MissionCardConfig | null | undefined
  missionFlagsLoading?: boolean
}

export function computeInternTabVisibility({
  lifecycleStatus,
  missionFlags,
  missionFlagsLoading = false,
}: ComputeInternTabVisibilityOptions): InternTabVisibilityMap {
  if (missionFlagsLoading) {
    return createVisibilityMap(true, true)
  }

  const visibility = createVisibilityMap(false, false)
  applyStaticTabs(visibility)

  if (lifecycleStatus !== 'ACTIVE') {
    return visibility
  }

  visibility.mission.isVisible = missionFlags?.missionOverview?.isVisible ?? true
  visibility.tasks.isVisible = missionFlags?.tasks?.isVisible ?? true
  visibility.deliverables.isVisible = missionFlags?.deliverables?.isVisible ?? true
  visibility.journal.isVisible = missionFlags?.journal?.isVisible ?? true
  visibility.evaluations.isVisible = missionFlags?.evaluation?.isVisible ?? true
  visibility.meetings.isVisible = missionFlags?.meeting?.isVisible ?? true

  return visibility
}

export function isInternDashboardTab(value: string | null | undefined): value is InternDashboardTab {
  return internDashboardTabs.includes(value as InternDashboardTab)
}

export function getFirstVisibleInternTab(visibility: InternTabVisibilityMap): InternDashboardTab {
  return internDashboardTabs.find((tab) => visibility[tab].isVisible) ?? 'overview'
}

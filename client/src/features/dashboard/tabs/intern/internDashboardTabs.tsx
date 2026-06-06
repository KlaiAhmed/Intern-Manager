import type { ReactNode } from 'react'
import {
  Briefcase,
  FileCheck,
  Overview,
  User,
  Users,
} from '../../components/IconComponents'
import type { InternDashboardTabId, InternDashboardTabVisibility } from '../../types/internDashboard'
import type { DashboardCard, MissionCardConfig } from '../../types/missionFeatureFlags'

interface InternDashboardTabDefinition {
  id: InternDashboardTabId
  labelKey: string
  icon: ReactNode
}

export const internDashboardTabDefinitions: InternDashboardTabDefinition[] = [
  { id: 'overview', labelKey: 'dashboard.intern.tabs.overview', icon: <Overview /> },
  { id: 'deliverables', labelKey: 'dashboard.intern.tabs.deliverables', icon: <FileCheck /> },
  { id: 'mission', labelKey: 'dashboard.intern.tabs.mission', icon: <Briefcase /> },
  { id: 'meetings', labelKey: 'dashboard.intern.tabs.meetings', icon: <Users size={20} /> },
  { id: 'profile', labelKey: 'dashboard.intern.tabs.profile', icon: <User size={20} /> },
]

function isCardVisible(flags: MissionCardConfig | null, card: DashboardCard): boolean {
  return flags?.[card]?.isVisible ?? true
}

export function getInternTabVisibility(flags: MissionCardConfig | null): InternDashboardTabVisibility {
  return {
    overview: true,
    deliverables: isCardVisible(flags, 'tasks') || isCardVisible(flags, 'deliverables'),
    mission: isCardVisible(flags, 'missionOverview'),
    meetings: isCardVisible(flags, 'meeting'),
    profile: true,
  }
}

export function getVisibleInternTabs(visibility: InternDashboardTabVisibility): InternDashboardTabDefinition[] {
  return internDashboardTabDefinitions.filter((tab) => visibility[tab.id])
}

export function getFirstVisibleInternTab(visibility: InternDashboardTabVisibility): InternDashboardTabId {
  return getVisibleInternTabs(visibility)[0]?.id ?? 'overview'
}

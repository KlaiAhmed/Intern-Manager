import type { Guid } from '../../types/intern.types'

export const internDashboardQueryKeys = {
  all: ['internDashboard'] as const,
  statuses: () => [...internDashboardQueryKeys.all, 'status'] as const,
  status: (internId: Guid | null | undefined) =>
    [...internDashboardQueryKeys.statuses(), internId ?? 'anonymous'] as const,
  mission: () => [...internDashboardQueryKeys.all, 'mission'] as const,
  missionSummary: () => [...internDashboardQueryKeys.mission(), 'summary'] as const,
  missionHistory: () => [...internDashboardQueryKeys.mission(), 'history'] as const,
  missionFeatureFlags: () => [...internDashboardQueryKeys.mission(), 'featureFlags'] as const,
  missionDocuments: (missionId: Guid | null | undefined) =>
    [...internDashboardQueryKeys.mission(), 'documents', missionId ?? 'none'] as const,
  tasks: () => [...internDashboardQueryKeys.all, 'tasks'] as const,
  deliverables: () => [...internDashboardQueryKeys.all, 'deliverables'] as const,
  deliverableVersions: (deliverableId: Guid | null | undefined) =>
    [...internDashboardQueryKeys.deliverables(), 'versions', deliverableId ?? 'none'] as const,
  journal: () => [...internDashboardQueryKeys.all, 'journal'] as const,
  evaluations: () => [...internDashboardQueryKeys.all, 'evaluations'] as const,
  meetings: () => [...internDashboardQueryKeys.all, 'meetings'] as const,
  meetingsCount: () => [...internDashboardQueryKeys.meetings(), 'count'] as const,
  profile: () => [...internDashboardQueryKeys.all, 'profile'] as const,
  schools: () => [...internDashboardQueryKeys.profile(), 'schools'] as const,
  skills: () => [...internDashboardQueryKeys.profile(), 'skills'] as const,
  notifications: () => [...internDashboardQueryKeys.all, 'notifications'] as const,
}

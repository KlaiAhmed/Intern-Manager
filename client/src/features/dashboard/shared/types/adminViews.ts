import type { SuperAdminSection } from '../../components/SuperAdminSidebar'

export type AdminView =
  | 'overview'
  | 'users'
  | 'interns'
  | 'internships'
  | 'missionFeatureFlags'
  | 'evaluations'
  | 'settings'
  | 'audit'
  | 'biPanel'

export const sectionPathMap: Record<SuperAdminSection, string> = {
  overview: '/dashboard/admin',
  users: '/dashboard/admin/users',
  internships: '/dashboard/admin/internships',
  missions: '/dashboard/admin/interns',
  evaluations: '/dashboard/admin/evaluations',
  settings: '/dashboard/admin/settings',
  audit: '/dashboard/admin/audit',
  biPanel: '/dashboard/admin/bi-panel',
}

export const sectionByView: Record<AdminView, SuperAdminSection> = {
  overview: 'overview',
  users: 'users',
  interns: 'missions',
  internships: 'internships',
  missionFeatureFlags: 'internships',
  evaluations: 'evaluations',
  settings: 'settings',
  audit: 'audit',
  biPanel: 'biPanel',
}

export function resolveAdminView(pathname: string): AdminView {
  if (pathname === '/dashboard/admin' || pathname === '/dashboard') {
    return 'overview'
  }

  if (pathname.startsWith('/dashboard/admin/users')) {
    return 'users'
  }

  if (pathname.startsWith('/dashboard/admin/internships')) {
    return 'internships'
  }

  if (pathname.startsWith('/dashboard/admin/missions/') && pathname.endsWith('/feature-flags')) {
    return 'missionFeatureFlags'
  }

  if (pathname.startsWith('/dashboard/admin/interns')) {
    return 'interns'
  }

  if (pathname.startsWith('/dashboard/admin/evaluations')) {
    return 'evaluations'
  }

  if (pathname.startsWith('/dashboard/admin/audit')) {
    return 'audit'
  }

  if (pathname.startsWith('/dashboard/admin/bi-panel')) {
    return 'biPanel'
  }

  return 'settings'
}

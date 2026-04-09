import type { SuperAdminSection } from '../../components/SuperAdminSidebar'

export type AdminView =
  | 'overview'
  | 'interns'
  | 'internships'
  | 'evaluations'
  | 'settings'
  | 'audit'
  | 'notificationsEmail'
  | 'archive'
  | 'biAccess'

export const sectionPathMap: Record<SuperAdminSection, string> = {
  overview: '/dashboard/admin',
  users: '/dashboard/admin',
  internships: '/dashboard/admin/internships',
  missions: '/dashboard/admin/interns',
  evaluations: '/dashboard/admin/evaluations',
  deliverables: '/dashboard/admin/notifications-email',
  matching: '/dashboard/admin/archive',
  settings: '/dashboard/admin/settings',
  audit: '/dashboard/admin/audit',
  biAccess: '/dashboard/admin/bi-access',
}

export const sectionByView: Record<AdminView, SuperAdminSection> = {
  overview: 'overview',
  interns: 'missions',
  internships: 'internships',
  evaluations: 'evaluations',
  settings: 'settings',
  audit: 'audit',
  notificationsEmail: 'deliverables',
  archive: 'matching',
  biAccess: 'biAccess',
}

export function resolveAdminView(pathname: string): AdminView {
  if (pathname === '/dashboard/admin' || pathname === '/dashboard' || pathname.startsWith('/dashboard/admin/users')) {
    return 'overview'
  }

  if (pathname.startsWith('/dashboard/admin/interns')) {
    return 'interns'
  }

  if (pathname.startsWith('/dashboard/admin/internships')) {
    return 'internships'
  }

  if (pathname.startsWith('/dashboard/admin/evaluations')) {
    return 'evaluations'
  }

  if (pathname.startsWith('/dashboard/admin/audit')) {
    return 'audit'
  }

  if (pathname.startsWith('/dashboard/admin/notifications-email')) {
    return 'notificationsEmail'
  }

  if (pathname.startsWith('/dashboard/admin/archive')) {
    return 'archive'
  }

  if (pathname.startsWith('/dashboard/admin/bi-access')) {
    return 'biAccess'
  }

  return 'settings'
}

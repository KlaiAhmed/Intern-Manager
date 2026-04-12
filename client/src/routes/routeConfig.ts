import type { ComponentType, LazyExoticComponent } from 'react'
import {
  DashboardPage,
  ErrorPage,
  ForgotPasswordPage,
  HomePage,
  LoginPage,
  NotFoundPage,
  SignUpPage,
} from './lazyPages'

export interface RouteDefinition {
  path: string
  component: LazyExoticComponent<ComponentType>
  isProtected?: boolean
  isGuestOnly?: boolean
  allowedRoles?: string[]
}

export const appRoutes: RouteDefinition[] = [
  { path: '/', component: HomePage },
  { path: '/dashboard', component: DashboardPage, isProtected: true },
  { path: '/dashboard/admin', component: DashboardPage, isProtected: true, allowedRoles: ['admin'] },
  { path: '/dashboard/admin/users', component: DashboardPage, isProtected: true, allowedRoles: ['admin'] },
  { path: '/dashboard/admin/interns', component: DashboardPage, isProtected: true, allowedRoles: ['admin'] },
  { path: '/dashboard/admin/internships', component: DashboardPage, isProtected: true, allowedRoles: ['admin'] },
  { path: '/dashboard/admin/missions/:missionId/feature-flags', component: DashboardPage, isProtected: true, allowedRoles: ['admin', 'super_admin'] },
  { path: '/dashboard/admin/evaluations', component: DashboardPage, isProtected: true, allowedRoles: ['admin'] },
  { path: '/dashboard/admin/settings', component: DashboardPage, isProtected: true, allowedRoles: ['admin'] },
  { path: '/dashboard/admin/audit', component: DashboardPage, isProtected: true, allowedRoles: ['admin'] },
  { path: '/dashboard/supervisor/interns/:internId/journal', component: DashboardPage, isProtected: true, allowedRoles: ['supervisor'] },
  { path: '/login', component: LoginPage, isGuestOnly: true },
  { path: '/signup', component: SignUpPage, isGuestOnly: true },
  { path: '/forgot-password', component: ForgotPasswordPage, isGuestOnly: true },
  { path: '/404', component: NotFoundPage },
  { path: '/error', component: ErrorPage },
]

export const fallbackRoute: RouteDefinition = {
  path: '*',
  component: NotFoundPage,
}

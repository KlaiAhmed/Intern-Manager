import type { ComponentType, LazyExoticComponent } from 'react'
import {
  DashboardPage,
  ErrorPage,
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
}

export const appRoutes: RouteDefinition[] = [
  { path: '/', component: HomePage },
  { path: '/dashboard', component: DashboardPage, isProtected: true },
  { path: '/login', component: LoginPage, isGuestOnly: true },
  { path: '/signup', component: SignUpPage, isGuestOnly: true },
  { path: '/404', component: NotFoundPage },
  { path: '/error', component: ErrorPage },
]

export const fallbackRoute: RouteDefinition = {
  path: '*',
  component: NotFoundPage,
}

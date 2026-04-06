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
}

export const appRoutes: RouteDefinition[] = [
  { path: '/', component: HomePage },
  { path: '/dashboard', component: DashboardPage, isProtected: true },
  { path: '/login', component: LoginPage },
  { path: '/signup', component: SignUpPage },
  { path: '/404', component: NotFoundPage },
  { path: '/error', component: ErrorPage },
]

export const fallbackRoute: RouteDefinition = {
  path: '*',
  component: NotFoundPage,
}

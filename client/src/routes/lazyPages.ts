import { lazy } from 'react'

export const HomePage = lazy(async () => {
  const module = await import('../pages/HomePage')
  return { default: module.HomePage }
})

export const DashboardPage = lazy(async () => {
  const module = await import('../pages/DashboardPage')
  return { default: module.DashboardPage }
})

export const ManagerDashboard = lazy(async () => { // Direct /dashboard/manager route uses the existing manager dashboard.
  const module = await import('../features/dashboard/pages/ManagerDashboard/ManagerDashboard') // Load the already-built manager dashboard.
  return { default: module.ManagerDashboard } // Expose the existing manager dashboard to routeConfig.
})

export const LoginPage = lazy(async () => {
  const module = await import('../pages/LoginPage')
  return { default: module.LoginPage }
})

export const SignUpPage = lazy(async () => {
  const module = await import('../pages/SignUpPage')
  return { default: module.SignUpPage }
})

export const ForgotPasswordPage = lazy(async () => {
  const module = await import('../pages/ForgotPasswordPage')
  return { default: module.ForgotPasswordPage }
})

export const NotFoundPage = lazy(async () => {
  const module = await import('../pages/NotFoundPage')
  return { default: module.NotFoundPage }
})

export const ErrorPage = lazy(async () => {
  const module = await import('../pages/ErrorPage')
  return { default: module.ErrorPage }
})

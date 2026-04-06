import type { UserRole } from '../../../types/role'

export type AuthVariant = 'login' | 'signup'

export interface AuthScreenProps {
  variant: AuthVariant
}

export interface FormValues {
  email: string
  password: string
  rememberMe: boolean
}

export interface FormErrors {
  email?: string
  password?: string
}

export interface RegisterValues {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
  role: UserRole
}

export interface RegisterErrors {
  firstName?: string
  lastName?: string
  email?: string
  password?: string
  confirmPassword?: string
}

export type LoginFieldName = 'email' | 'password'
export type RegisterFieldName = 'firstName' | 'lastName' | 'email' | 'password' | 'confirmPassword'
export type RoleTranslationKey = `role.${UserRole}`

import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../../locales/I18nContext'
import { usePageMetadata } from '../../../hooks/usePageMetadata'
import { useAuth } from '../../../stores/AuthContext'
import { ApiRequestError } from '../../../lib/authApi'
import { getConfirmPasswordErrorKey, getPasswordPolicyErrorKey } from '../../../utils/passwordValidation'
import type {
  AuthVariant,
  FormErrors,
  FormValues,
  LoginFieldName,
  RegisterErrors,
  RegisterFieldName,
  RegisterValues,
} from '../types/authScreen'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function useAuthScreenLogic(variant: AuthVariant) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { login, signup } = useAuth()

  const [values, setValues] = useState<FormValues>({
    email: '',
    password: '',
    rememberMe: false,
  })

  const [registerValues, setRegisterValues] = useState<RegisterValues>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'intern',
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [registerErrors, setRegisterErrors] = useState<RegisterErrors>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false)
  const [isLoginPasswordVisible, setIsLoginPasswordVisible] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const isSignUpVariant = variant === 'signup'
  const pageTitle = isSignUpVariant ? t('auth.meta.signinTitle') : t('auth.meta.loginTitle')
  const heading = isSignUpVariant ? t('auth.heading.signin') : t('auth.heading.login')
  const description = t('auth.description.shared')
  const submitLabel = isSignUpVariant ? t('auth.action.createAccount') : t('auth.action.login')

  usePageMetadata({
    title: pageTitle,
    description: t('auth.meta.description'),
    path: isSignUpVariant ? '/signup' : '/login',
  })

  const validateLoginField = (field: LoginFieldName, value: string): string | undefined => {
    if (field === 'email') {
      if (!value.trim()) {
        return t('auth.validation.emailRequired')
      }

      if (!emailPattern.test(value.trim())) {
        return t('auth.validation.emailInvalid')
      }

      return undefined
    }

    if (!value.trim()) {
      return t('auth.validation.passwordRequired')
    }

    return undefined
  }

  const validateRegisterField = (
    field: RegisterFieldName,
    fieldValue: string,
    allValues: RegisterValues,
  ): string | undefined => {
    if (field === 'firstName') {
      return fieldValue.trim() ? undefined : t('auth.validation.firstNameRequired')
    }

    if (field === 'lastName') {
      return fieldValue.trim() ? undefined : t('auth.validation.lastNameRequired')
    }

    if (field === 'email') {
      if (!fieldValue.trim()) {
        return t('auth.validation.emailRequired')
      }

      if (!emailPattern.test(fieldValue.trim())) {
        return t('auth.validation.emailInvalid')
      }

      return undefined
    }

    if (field === 'password') {
      const passwordErrorKey = getPasswordPolicyErrorKey(fieldValue)
      return passwordErrorKey ? t(passwordErrorKey) : undefined
    }

    const confirmPasswordErrorKey = getConfirmPasswordErrorKey(allValues.password, fieldValue)
    return confirmPasswordErrorKey ? t(confirmPasswordErrorKey) : undefined
  }

  const validateForm = (): FormErrors => {
    const nextErrors: FormErrors = {}

    const emailError = validateLoginField('email', values.email)
    const passwordError = validateLoginField('password', values.password)

    if (emailError) {
      nextErrors.email = emailError
    }

    if (passwordError) {
      nextErrors.password = passwordError
    }

    return nextErrors
  }

  const validateRegisterForm = (): RegisterErrors => {
    const nextErrors: RegisterErrors = {}

    const firstNameError = validateRegisterField('firstName', registerValues.firstName, registerValues)
    const lastNameError = validateRegisterField('lastName', registerValues.lastName, registerValues)
    const emailError = validateRegisterField('email', registerValues.email, registerValues)
    const passwordError = validateRegisterField('password', registerValues.password, registerValues)
    const confirmPasswordError = validateRegisterField(
      'confirmPassword',
      registerValues.confirmPassword,
      registerValues,
    )

    if (firstNameError) {
      nextErrors.firstName = firstNameError
    }

    if (lastNameError) {
      nextErrors.lastName = lastNameError
    }

    if (emailError) {
      nextErrors.email = emailError
    }

    if (passwordError) {
      nextErrors.password = passwordError
    }

    if (confirmPasswordError) {
      nextErrors.confirmPassword = confirmPasswordError
    }

    return nextErrors
  }

  const handleLogin = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setSubmitError(null)

    const nextErrors = validateForm()
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsLoading(true)

    try {
      await login(values.email.trim(), values.password, values.rememberMe)
      navigate('/', { replace: true })
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (error.status === 401) {
          setSubmitError(t('auth.error.invalidCredentials'))
        } else {
          setSubmitError(error.message || t('auth.error.unexpected'))
        }
      } else if (error instanceof TypeError) {
        setSubmitError(t('auth.error.network'))
      } else if (error instanceof Error && error.message === 'AUTH_PROFILE_UNAVAILABLE') {
        setSubmitError(t('auth.error.profileUnavailable'))
      } else {
        setSubmitError(t('auth.error.unexpected'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setSubmitError(null)

    const nextErrors = validateRegisterForm()
    setRegisterErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsLoading(true)

    try {
      await signup(
        registerValues.firstName.trim(),
        registerValues.lastName.trim(),
        registerValues.email.trim(),
        registerValues.password,
        registerValues.role,
      )
      navigate('/', { replace: true })
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (error.status === 409) {
          setSubmitError(t('auth.error.emailAlreadyExists'))
        } else {
          setSubmitError(error.message || t('auth.error.unexpected'))
        }
      } else if (error instanceof TypeError) {
        setSubmitError(t('auth.error.network'))
      } else if (error instanceof Error && error.message === 'AUTH_PROFILE_UNAVAILABLE') {
        setSubmitError(t('auth.error.profileUnavailable'))
      } else {
        setSubmitError(t('auth.error.unexpected'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  return {
    t,
    values,
    setValues,
    registerValues,
    setRegisterValues,
    errors,
    setErrors,
    registerErrors,
    setRegisterErrors,
    isLoading,
    isPasswordVisible,
    setIsPasswordVisible,
    isConfirmPasswordVisible,
    setIsConfirmPasswordVisible,
    isLoginPasswordVisible,
    setIsLoginPasswordVisible,
    submitError,
    setSubmitError,
    isSignUpVariant,
    heading,
    description,
    submitLabel,
    validateLoginField,
    validateRegisterField,
    handleLogin,
    handleRegister,
  }
}

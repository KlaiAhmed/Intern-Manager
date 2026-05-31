import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePageMetadata } from '../../../hooks/usePageMetadata'
import { useI18n } from '../../../locales/I18nContext'
import { getConfirmPasswordErrorKey, getPasswordPolicyErrorKey } from '../../../utils/passwordValidation'
import {
  ApiRequestError,
  requestPasswordResetCode,
  resetPasswordWithVerification,
  verifyPasswordResetCode,
} from '../../../lib/authApi'

type ForgotPasswordStep = 'email' | 'code' | 'password'

interface PasswordFieldErrors {
  newPassword?: string
  confirmPassword?: string
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const PASSWORD_RESET_CODE_LENGTH = 8 // Backend reset codes are exactly 8 digits.
const codePattern = new RegExp(`^\\d{${PASSWORD_RESET_CODE_LENGTH}}$`) // Keep client validation aligned with backend OTP length.

function normalizeCodeInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, PASSWORD_RESET_CODE_LENGTH) // Keep pasted OTP input aligned with backend length.
}

export function useForgotPasswordLogic() {
  const { t } = useI18n()
  const navigate = useNavigate()

  const [step, setStep] = useState<ForgotPasswordStep>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [verificationToken, setVerificationToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordErrors, setPasswordErrors] = useState<PasswordFieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false)

  usePageMetadata({
    title: t('auth.meta.resetTitle'),
    description: t('auth.meta.description'),
    path: '/forgot-password',
  })

  useEffect(() => {
    if (resendCooldown <= 0) {
      return
    }

    const intervalId = window.setInterval(() => {
      setResendCooldown((current) => (current > 0 ? current - 1 : 0))
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [resendCooldown])

  const codeMessage = useMemo(() => {
    return t('auth.reset.codeSentTo').replace('{{email}}', email)
  }, [email, t])

  const getNewPasswordError = (password: string): string | undefined => {
    const errorKey = getPasswordPolicyErrorKey(password)
    return errorKey ? t(errorKey) : undefined
  }

  const getConfirmPasswordError = (password: string, confirmation: string): string | undefined => {
    const errorKey = getConfirmPasswordErrorKey(password, confirmation)
    return errorKey ? t(errorKey) : undefined
  }

  const syncPasswordErrors = (nextPassword: string, nextConfirmPassword: string): void => {
    setPasswordErrors({
      newPassword: getNewPasswordError(nextPassword),
      confirmPassword: getConfirmPasswordError(nextPassword, nextConfirmPassword),
    })
  }

  const handleSendCode = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setSubmitError(null)

    const normalizedEmail = email.trim()
    if (!emailPattern.test(normalizedEmail)) {
      setSubmitError(t('auth.validation.emailInvalid'))
      return
    }

    setIsSubmitting(true)

    try {
      await requestPasswordResetCode(normalizedEmail)
      setEmail(normalizedEmail)
      setCode('')
      setVerificationToken('')
      setStep('code')
      setResendCooldown(60)
    } catch {
      setSubmitError(t('auth.reset.error.generic'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerifyCode = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setSubmitError(null)

    const normalizedCode = normalizeCodeInput(code)
    if (!codePattern.test(normalizedCode)) {
      setSubmitError(t('auth.reset.error.invalidCode'))
      return
    }

    setIsSubmitting(true)

    try {
      const nextVerificationToken = await verifyPasswordResetCode(email, normalizedCode)
      setCode(normalizedCode)
      setVerificationToken(nextVerificationToken)
      setPasswordErrors({})
      setStep('password')
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 400) {
        setSubmitError(t('auth.reset.error.invalidCode'))
      } else {
        setSubmitError(t('auth.reset.error.generic'))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResendCode = async (): Promise<void> => {
    if (isSubmitting || resendCooldown > 0) {
      return
    }

    setSubmitError(null)
    setIsSubmitting(true)

    try {
      await requestPasswordResetCode(email)
      setResendCooldown(60)
    } catch {
      setSubmitError(t('auth.reset.error.generic'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetPassword = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setSubmitError(null)

    const nextErrors: PasswordFieldErrors = {
      newPassword: getNewPasswordError(newPassword),
      confirmPassword: getConfirmPasswordError(newPassword, confirmPassword),
    }

    setPasswordErrors(nextErrors)

    if (nextErrors.newPassword || nextErrors.confirmPassword) {
      return
    }

    const normalizedPassword = newPassword.trim()

    setIsSubmitting(true)

    try {
      await resetPasswordWithVerification(verificationToken, normalizedPassword, confirmPassword.trim())
      navigate('/login?reset=success', { replace: true })
    } catch {
      setSubmitError(t('auth.reset.error.generic'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    t,
    step,
    email,
    code,
    newPassword,
    confirmPassword,
    passwordErrors,
    isSubmitting,
    submitError,
    resendCooldown,
    isPasswordVisible,
    isConfirmPasswordVisible,
    codeMessage,
    setEmail,
    setCode,
    handleNewPasswordChange: (value: string) => {
      setNewPassword(value)
      setSubmitError(null)
      syncPasswordErrors(value, confirmPassword)
    },
    handleConfirmPasswordChange: (value: string) => {
      setConfirmPassword(value)
      setSubmitError(null)
      syncPasswordErrors(newPassword, value)
    },
    setIsPasswordVisible,
    setIsConfirmPasswordVisible,
    handleSendCode,
    handleVerifyCode,
    handleResendCode,
    handleResetPassword,
  }
}

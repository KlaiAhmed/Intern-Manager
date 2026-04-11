import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePageMetadata } from '../../../hooks/usePageMetadata'
import { useI18n } from '../../../locales/I18nContext'
import {
  ApiRequestError,
  requestPasswordResetCode,
  resetPasswordWithVerification,
  verifyPasswordResetCode,
} from '../../../lib/authApi'

type ForgotPasswordStep = 'email' | 'code' | 'password'

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const codePattern = /^\d{6}$/

function isPasswordPolicyValid(password: string): boolean {
  if (password.length < 8) {
    return false
  }

  let hasUpper = false
  let hasLower = false
  let hasDigit = false
  let hasSpecial = false

  for (const character of password) {
    if (character >= 'A' && character <= 'Z') {
      hasUpper = true
      continue
    }

    if (character >= 'a' && character <= 'z') {
      hasLower = true
      continue
    }

    if (character >= '0' && character <= '9') {
      hasDigit = true
      continue
    }

    hasSpecial = true
  }

  return hasUpper && hasLower && hasDigit && hasSpecial
}

function normalizeCodeInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, 6)
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

    const normalizedPassword = newPassword.trim()

    if (!isPasswordPolicyValid(normalizedPassword)) {
      setSubmitError(t('auth.validation.passwordPolicy'))
      return
    }

    if (normalizedPassword !== confirmPassword.trim()) {
      setSubmitError(t('auth.validation.passwordsMismatch'))
      return
    }

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
    isSubmitting,
    submitError,
    resendCooldown,
    isPasswordVisible,
    isConfirmPasswordVisible,
    codeMessage,
    setEmail,
    setCode,
    setNewPassword,
    setConfirmPassword,
    setIsPasswordVisible,
    setIsConfirmPasswordVisible,
    handleSendCode,
    handleVerifyCode,
    handleResendCode,
    handleResetPassword,
  }
}

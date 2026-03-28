import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { availableRoles, type UserRole } from '../../../shared/types/role'
import { classNames } from '../../../shared/utils/classNames'
import { LanguageSwitcher } from '../../../shared/ui/LanguageSwitcher'
import { ThemeSwitcher } from '../../../shared/ui/ThemeSwitcher'
import { usePageMetadata } from '../../../shared/seo/usePageMetadata'
import styles from './AuthScreen.module.css'

type AuthVariant = 'login' | 'signup'

interface AuthScreenProps {
  variant: AuthVariant
}

interface FormValues {
  email: string
  password: string
  rememberMe: boolean
}

interface FormErrors {
  email?: string
  password?: string
}

interface RegisterValues {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
  role: UserRole
}

interface RegisterErrors {
  firstName?: string
  lastName?: string
  email?: string
  password?: string
  confirmPassword?: string
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type LoginFieldName = 'email' | 'password'
type RegisterFieldName = 'firstName' | 'lastName' | 'email' | 'password' | 'confirmPassword'
type RoleTranslationKey = `role.${UserRole}`

/**
 * Ecran d'authentification responsive qui affiche soit le formulaire de connexion,
 * soit le formulaire d'inscription selon la variante de route.
 */
export function AuthScreen({ variant }: AuthScreenProps) {
  const { t } = useI18n()
  const roleMenuRef = useRef<HTMLDivElement | null>(null)
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
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false)
  const [isRoleMenuUpward, setIsRoleMenuUpward] = useState(false)

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

  useEffect(() => {
    // Ferme le dropdown de role lors d'un clic externe ou d'un appui sur Echap.
    const onPointerDown = (event: MouseEvent): void => {
      if (!roleMenuRef.current) {
        return
      }

      const target = event.target
      if (!(target instanceof Node)) {
        return
      }

      if (!roleMenuRef.current.contains(target)) {
        setIsRoleMenuOpen(false)
      }
    }

    const onEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsRoleMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onEscape)

    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onEscape)
    }
  }, [])

  useEffect(() => {
    if (!isRoleMenuOpen) {
      return
    }

    // Positionne le menu de role vers le haut si l'espace en bas est insuffisant.
    const updateRoleMenuDirection = (): void => {
      if (!roleMenuRef.current) {
        return
      }

      const roleCount = availableRoles.length
      const estimatedMenuHeight = roleCount * 42 + 20
      const rect = roleMenuRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top

      setIsRoleMenuUpward(spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow)
    }

    updateRoleMenuDirection()
    window.addEventListener('resize', updateRoleMenuDirection)

    return () => {
      window.removeEventListener('resize', updateRoleMenuDirection)
    }
  }, [isRoleMenuOpen])

  /**
   * Valide un champ de connexion individuellement pour afficher un feedback en temps reel.
   */
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

  /**
   * Valide un champ d'inscription individuellement avec gestion des dependances entre mots de passe.
   */
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
      if (!fieldValue.trim()) {
        return t('auth.validation.passwordRequired')
      }

      if (fieldValue.length < 8) {
        return t('auth.validation.passwordMin')
      }

      return undefined
    }

    if (!fieldValue.trim()) {
      return t('auth.validation.confirmPasswordRequired')
    }

    if (allValues.password !== fieldValue) {
      return t('auth.validation.passwordsMismatch')
    }

    return undefined
  }

  const validateForm = (): FormErrors => {
    const nextErrors: FormErrors = {}

    nextErrors.email = validateLoginField('email', values.email)
    nextErrors.password = validateLoginField('password', values.password)

    return nextErrors
  }

  /**
   * Valide les champs d'inscription avec regles de base avant simulation d'envoi.
   */
  const validateRegisterForm = (): RegisterErrors => {
    const nextErrors: RegisterErrors = {}

    nextErrors.firstName = validateRegisterField('firstName', registerValues.firstName, registerValues)
    nextErrors.lastName = validateRegisterField('lastName', registerValues.lastName, registerValues)
    nextErrors.email = validateRegisterField('email', registerValues.email, registerValues)
    nextErrors.password = validateRegisterField('password', registerValues.password, registerValues)
    nextErrors.confirmPassword = validateRegisterField(
      'confirmPassword',
      registerValues.confirmPassword,
      registerValues,
    )

    return nextErrors
  }

  /**
   * Simule un appel API de connexion pour valider les interactions UI avant le backend reel.
   */
  const handleLogin = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()

    const nextErrors = validateForm()
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    const payload = {
      email: values.email.trim(),
      password: values.password,
      rememberMe: values.rememberMe,
      mode: variant,
    }

    setIsLoading(true)

    await new Promise<void>((resolve) => {
      window.setTimeout(() => resolve(), 1000)
    })

    console.log('Mock login payload:', payload)
    setIsLoading(false)
  }

  /**
   * Simule la creation de compte en validant les champs, affichant un loader, puis en loggant le payload.
   */
  const handleRegister = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()

    const nextErrors = validateRegisterForm()
    setRegisterErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    const payload = {
      firstName: registerValues.firstName.trim(),
      lastName: registerValues.lastName.trim(),
      email: registerValues.email.trim(),
      password: registerValues.password,
      role: registerValues.role,
    }

    setIsLoading(true)

    await new Promise<void>((resolve) => {
      window.setTimeout(() => resolve(), 1000)
    })

    console.log('Mock register payload:', payload)
    setIsLoading(false)
  }

  if (isSignUpVariant) {
    return (
      <main className={styles.signInPage}>
        <section className={styles.signInSection}>
          <div className={styles.signInCard}>
            <div className={styles.authUtilityBar}>
              <Link className={styles.homeLink} to="/">
                <span aria-hidden="true">&#8592;</span>
                {t('nav.home')}
              </Link>

              <div className={styles.authUtilityActions}>
                <LanguageSwitcher />
                <ThemeSwitcher />
              </div>
            </div>

            <div className={styles.textCenter}>
              <p className={styles.brandTag}>Axia</p>
              <h1 className={styles.signInHeading}>{heading}</h1>
              <p className={styles.signInDescription}>
                {t('auth.signin.description')}
              </p>
            </div>

            <form className={styles.registerForm} noValidate onSubmit={handleRegister}>
              <div className={styles.nameGrid}>
                <div className={styles.fieldStack}>
                  <label className={styles.label} htmlFor="firstName">
                    {t('auth.signin.firstName')}
                  </label>
                  <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    autoComplete="given-name"
                    value={registerValues.firstName}
                    onChange={(event) => {
                      const nextFirstName = event.target.value
                      const nextValues = { ...registerValues, firstName: nextFirstName }

                      setRegisterValues(nextValues)
                      setRegisterErrors((previous) => ({
                        ...previous,
                        firstName: validateRegisterField('firstName', nextFirstName, nextValues),
                      }))
                    }}
                    className={classNames(styles.input, registerErrors.firstName && styles.inputError)}
                    placeholder={t('auth.placeholder.firstName')}
                    aria-invalid={Boolean(registerErrors.firstName)}
                    aria-describedby={registerErrors.firstName ? 'first-name-error' : undefined}
                  />
                  {registerErrors.firstName ? (
                    <p id="first-name-error" className={styles.errorText}>
                      {registerErrors.firstName}
                    </p>
                  ) : null}
                </div>

                <div className={styles.fieldStack}>
                  <label className={styles.label} htmlFor="lastName">
                    {t('auth.signin.lastName')}
                  </label>
                  <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    autoComplete="family-name"
                    value={registerValues.lastName}
                    onChange={(event) => {
                      const nextLastName = event.target.value
                      const nextValues = { ...registerValues, lastName: nextLastName }

                      setRegisterValues(nextValues)
                      setRegisterErrors((previous) => ({
                        ...previous,
                        lastName: validateRegisterField('lastName', nextLastName, nextValues),
                      }))
                    }}
                    className={classNames(styles.input, registerErrors.lastName && styles.inputError)}
                    placeholder={t('auth.placeholder.lastName')}
                    aria-invalid={Boolean(registerErrors.lastName)}
                    aria-describedby={registerErrors.lastName ? 'last-name-error' : undefined}
                  />
                  {registerErrors.lastName ? (
                    <p id="last-name-error" className={styles.errorText}>
                      {registerErrors.lastName}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className={styles.fieldStack}>
                <label className={styles.label} htmlFor="registerEmail">
                  {t('auth.signin.email')}
                </label>
                <input
                  id="registerEmail"
                  name="registerEmail"
                  type="email"
                  autoComplete="email"
                  value={registerValues.email}
                  onChange={(event) => {
                    const nextEmail = event.target.value
                    const nextValues = { ...registerValues, email: nextEmail }

                    setRegisterValues(nextValues)
                    setRegisterErrors((previous) => ({
                      ...previous,
                      email: validateRegisterField('email', nextEmail, nextValues),
                    }))
                  }}
                  className={classNames(styles.input, registerErrors.email && styles.inputError)}
                  placeholder={t('auth.placeholder.email')}
                  aria-invalid={Boolean(registerErrors.email)}
                  aria-describedby={registerErrors.email ? 'register-email-error' : undefined}
                />
                {registerErrors.email ? (
                  <p id="register-email-error" className={styles.errorText}>
                    {registerErrors.email}
                  </p>
                ) : null}
              </div>

              <div className={styles.fieldStack}>
                <label className={styles.label} htmlFor="registerPassword">
                  {t('auth.signin.password')}
                </label>
                <div className={styles.relative}>
                  <input
                    id="registerPassword"
                    name="registerPassword"
                    type={isPasswordVisible ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={registerValues.password}
                    onChange={(event) => {
                      const nextPassword = event.target.value
                      const nextValues = { ...registerValues, password: nextPassword }

                      setRegisterValues(nextValues)
                      setRegisterErrors((previous) => ({
                        ...previous,
                        password: validateRegisterField('password', nextPassword, nextValues),
                        confirmPassword: validateRegisterField(
                          'confirmPassword',
                          nextValues.confirmPassword,
                          nextValues,
                        ),
                      }))
                    }}
                    className={classNames(
                      styles.input,
                      styles.inputWithIcon,
                      registerErrors.password && styles.inputError,
                    )}
                    placeholder={t('auth.placeholder.passwordMin8')}
                    aria-invalid={Boolean(registerErrors.password)}
                    aria-describedby={registerErrors.password ? 'register-password-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setIsPasswordVisible((previous) => !previous)}
                    className={styles.iconButton}
                    aria-label={isPasswordVisible ? t('auth.aria.hidePassword') : t('auth.aria.showPassword')}
                  >
                    {isPasswordVisible ? (
                      <svg viewBox="0 0 24 24" fill="none" className={styles.icon} aria-hidden="true">
                        <path
                          d="M3 3L21 21M10.58 10.58A2 2 0 0013.41 13.41M9.88 5.09A9.77 9.77 0 0112 4c5 0 9 4 10 8a11.8 11.8 0 01-3.32 5.07M6.1 6.1A11.76 11.76 0 002 12c1 4 5 8 10 8a9.77 9.77 0 005.33-1.66"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" className={styles.icon} aria-hidden="true">
                        <path
                          d="M2 12S6 4 12 4s10 8 10 8-4 8-10 8-10-8-10-8z"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                      </svg>
                    )}
                  </button>
                </div>
                {registerErrors.password ? (
                  <p id="register-password-error" className={styles.errorText}>
                    {registerErrors.password}
                  </p>
                ) : null}
              </div>

              <div className={styles.fieldStack}>
                <label className={styles.label} htmlFor="confirmPassword">
                  {t('auth.signin.confirmPassword')}
                </label>
                <div className={styles.relative}>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={isConfirmPasswordVisible ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={registerValues.confirmPassword}
                    onChange={(event) => {
                      const nextConfirmPassword = event.target.value
                      const nextValues = { ...registerValues, confirmPassword: nextConfirmPassword }

                      setRegisterValues(nextValues)
                      setRegisterErrors((previous) => ({
                        ...previous,
                        confirmPassword: validateRegisterField(
                          'confirmPassword',
                          nextConfirmPassword,
                          nextValues,
                        ),
                      }))
                    }}
                    className={classNames(
                      styles.input,
                      styles.inputWithIcon,
                      registerErrors.confirmPassword && styles.inputError,
                    )}
                    placeholder={t('auth.placeholder.confirmPassword')}
                    aria-invalid={Boolean(registerErrors.confirmPassword)}
                    aria-describedby={registerErrors.confirmPassword ? 'confirm-password-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setIsConfirmPasswordVisible((previous) => !previous)}
                    className={styles.iconButton}
                    aria-label={
                      isConfirmPasswordVisible ? t('auth.aria.hideConfirmPassword') : t('auth.aria.showConfirmPassword')
                    }
                  >
                    {isConfirmPasswordVisible ? (
                      <svg viewBox="0 0 24 24" fill="none" className={styles.icon} aria-hidden="true">
                        <path
                          d="M3 3L21 21M10.58 10.58A2 2 0 0013.41 13.41M9.88 5.09A9.77 9.77 0 0112 4c5 0 9 4 10 8a11.8 11.8 0 01-3.32 5.07M6.1 6.1A11.76 11.76 0 002 12c1 4 5 8 10 8a9.77 9.77 0 005.33-1.66"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" className={styles.icon} aria-hidden="true">
                        <path
                          d="M2 12S6 4 12 4s10 8 10 8-4 8-10 8-10-8-10-8z"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
                      </svg>
                    )}
                  </button>
                </div>
                {registerErrors.confirmPassword ? (
                  <p id="confirm-password-error" className={styles.errorText}>
                    {registerErrors.confirmPassword}
                  </p>
                ) : null}
              </div>

              <div className={styles.fieldStack}>
                <label className={styles.label} htmlFor="role">
                  {t('auth.signin.role')}
                </label>
                <div ref={roleMenuRef} className={styles.relative}>
                  <button
                    id="role"
                    name="role"
                    type="button"
                    className={styles.customSelectTrigger}
                    onClick={() => {
                      setIsRoleMenuOpen((previous) => {
                        if (!previous && roleMenuRef.current) {
                          const roleCount = availableRoles.length
                          const estimatedMenuHeight = roleCount * 42 + 20
                          const rect = roleMenuRef.current.getBoundingClientRect()
                          const spaceBelow = window.innerHeight - rect.bottom
                          const spaceAbove = rect.top

                          setIsRoleMenuUpward(spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow)
                        }

                        return !previous
                      })
                    }}
                    aria-haspopup="listbox"
                    aria-expanded={isRoleMenuOpen}
                    aria-label={t('auth.aria.selectRole')}
                  >
                    <span className={styles.customSelectValue}>
                      {t(`role.${registerValues.role}` as RoleTranslationKey)}
                    </span>
                  </button>

                  {isRoleMenuOpen ? (
                    <div
                      className={classNames(styles.customSelectMenu, isRoleMenuUpward && styles.customSelectMenuTop)}
                      role="listbox"
                      aria-label={t('auth.aria.roleOptions')}
                    >
                      {availableRoles.map((role) => {
                        const isSelected = role === registerValues.role

                        return (
                          <button
                            key={role}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            className={classNames(styles.customSelectOption, isSelected && styles.customSelectOptionActive)}
                            onClick={() => {
                              setRegisterValues((previous) => ({ ...previous, role }))
                              setIsRoleMenuOpen(false)
                            }}
                          >
                            {t(`role.${role}` as RoleTranslationKey)}
                          </button>
                        )
                      })}
                    </div>
                  ) : null}

                  <span className={styles.selectCaret} aria-hidden="true">
                    <svg viewBox="0 0 20 20" fill="none" className={styles.selectCaretIcon}>
                      <path
                        d="M5 7.5L10 12.5L15 7.5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </div>
                <p className={styles.roleHint}>{t('auth.signin.roleHint')}</p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={styles.submitButton}
              >
                {isLoading ? (
                  <>
                    <svg
                      className={styles.spinner}
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                      <path
                        d="M22 12a10 10 0 0 1-10 10"
                        stroke="currentColor"
                        strokeWidth="4"
                        opacity="0.9"
                      />
                    </svg>
                    {t('auth.loading.createAccount')}
                  </>
                ) : (
                  submitLabel
                )}
              </button>
            </form>

            <p className={styles.bottomText}>
              {t('auth.link.alreadyHaveAccount')}{' '}
              <Link className={styles.linkPrimary} to="/login">
                {t('auth.action.login')}
              </Link>
            </p>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className={styles.authPage}>
      <section className={styles.authLayout}>
        <aside className={styles.authBranding}>
          <div className={styles.blurOrbLeft} aria-hidden="true" />
          <div className={styles.blurOrbRight} aria-hidden="true" />

          <div className={styles.authBrandingContent}>
            <div>
              <p className={styles.heroBadge}>
                AXIA
              </p>
              <h1 className={styles.heroTitle}>
                {t('auth.hero.title')}
              </h1>
              <p className={styles.heroDescription}>{description}</p>
            </div>

            <dl className={styles.authKpis}>
              <div className={styles.authKpi}>
                <dt className={styles.kpiLabel}>{t('auth.kpi.activeInterns')}</dt>
                <dd className={styles.kpiValue}>240+</dd>
              </div>
              <div className={styles.authKpi}>
                <dt className={styles.kpiLabel}>{t('auth.kpi.mentorsOnboarded')}</dt>
                <dd className={styles.kpiValue}>62</dd>
              </div>
              <div className={styles.authKpi}>
                <dt className={styles.kpiLabel}>{t('auth.kpi.completionRate')}</dt>
                <dd className={styles.kpiValue}>95%</dd>
              </div>
            </dl>
          </div>
        </aside>

        <div className={styles.authFormWrap}>
          <div className={styles.authFormPanel}>
            <div className={styles.authUtilityBar}>
              <Link className={styles.homeLink} to="/">
                <span aria-hidden="true">&#8592;</span>
                {t('nav.home')}
              </Link>

              <div className={styles.authUtilityActions}>
                <LanguageSwitcher />
                <ThemeSwitcher />
              </div>
            </div>

            <div>
              <h2 className={styles.loginHeading}>{heading}</h2>
              <p className={styles.loginDescription}>{t('auth.login.description')}</p>
            </div>

            <form className={styles.loginForm} noValidate onSubmit={handleLogin}>
              <div className={styles.fieldStack}>
                <label className={styles.label} htmlFor="email">
                  {t('auth.login.email')}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={values.email}
                  onChange={(event) => {
                    const nextEmail = event.target.value

                    setValues((previous) => ({ ...previous, email: nextEmail }))
                    setErrors((previous) => ({
                      ...previous,
                      email: validateLoginField('email', nextEmail),
                    }))
                  }}
                  className={classNames(styles.input, errors.email && styles.inputError)}
                  placeholder={t('auth.placeholder.email')}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                />
                {errors.email ? (
                  <p id="email-error" className={styles.errorText}>
                    {errors.email}
                  </p>
                ) : null}
              </div>

              <div className={styles.fieldStack}>
                <label className={styles.label} htmlFor="password">
                  {t('auth.login.password')}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={values.password}
                  onChange={(event) => {
                    const nextPassword = event.target.value

                    setValues((previous) => ({ ...previous, password: nextPassword }))
                    setErrors((previous) => ({
                      ...previous,
                      password: validateLoginField('password', nextPassword),
                    }))
                  }}
                  className={classNames(styles.input, errors.password && styles.inputError)}
                  placeholder={t('auth.placeholder.loginPassword')}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                />
                {errors.password ? (
                  <p id="password-error" className={styles.errorText}>
                    {errors.password}
                  </p>
                ) : null}
              </div>

              <div className={styles.rememberRow}>
                <label className={styles.rememberLabel} htmlFor="rememberMe">
                  <input
                    id="rememberMe"
                    name="rememberMe"
                    type="checkbox"
                    checked={values.rememberMe}
                    onChange={(event) => {
                      setValues((previous) => ({ ...previous, rememberMe: event.target.checked }))
                    }}
                    className={styles.checkbox}
                  />
                  {t('auth.login.rememberMe')}
                </label>

                <a className={styles.forgotLink} href="#">
                  {t('auth.login.forgotPassword')}
                </a>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className={styles.submitButton}
              >
                {isLoading ? (
                  <>
                    <svg
                      className={styles.spinner}
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                      <path
                        d="M22 12a10 10 0 0 1-10 10"
                        stroke="currentColor"
                        strokeWidth="4"
                        opacity="0.9"
                      />
                    </svg>
                    {t('auth.loading.signingIn')}
                  </>
                ) : (
                  submitLabel
                )}
              </button>

            </form>

            <p className={styles.bottomText}>
              {isSignUpVariant ? t('auth.link.alreadyHaveAccount') : t('auth.link.needAccount')}{' '}
              <Link className={styles.linkPrimary} to={isSignUpVariant ? '/login' : '/signup'}>
                {isSignUpVariant ? t('auth.action.login') : t('auth.action.createAccount')}
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

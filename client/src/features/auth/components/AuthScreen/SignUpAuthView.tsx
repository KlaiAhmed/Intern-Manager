import { Link } from 'react-router-dom'
import { classNames } from '../../../../utils/classNames'
import { LanguageSwitcher } from '../../../../components/ui/LanguageSwitcher'
import { ThemeSwitcher } from '../../../../components/ui/ThemeSwitcher'
import type { AuthScreenLogic } from './types'
import { PasswordVisibilityIcon } from './PasswordVisibilityIcon'
import styles from '../../styles/SignUpAuthView.module.css'

interface SignUpAuthViewProps {
  logic: AuthScreenLogic
}

export function SignUpAuthView({ logic }: SignUpAuthViewProps) {
  const {
    t,
    registerValues,
    setRegisterValues,
    registerErrors,
    setRegisterErrors,
    isLoading,
    isPasswordVisible,
    setIsPasswordVisible,
    isConfirmPasswordVisible,
    setIsConfirmPasswordVisible,
    submitError,
    setSubmitError,
    heading,
    submitLabel,
    validateRegisterField,
    handleRegister,
  } = logic

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
                    setSubmitError(null)
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
                    setSubmitError(null)
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
                  setSubmitError(null)
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
                    setSubmitError(null)
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
                  <PasswordVisibilityIcon isVisible={isPasswordVisible} className={styles.icon} />
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
                    setSubmitError(null)
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
                  <PasswordVisibilityIcon isVisible={isConfirmPasswordVisible} className={styles.icon} />
                </button>
              </div>
              {registerErrors.confirmPassword ? (
                <p id="confirm-password-error" className={styles.errorText}>
                  {registerErrors.confirmPassword}
                </p>
              ) : null}
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

            {submitError ? (
              <p className={styles.errorText} role="alert">
                {submitError}
              </p>
            ) : null}
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

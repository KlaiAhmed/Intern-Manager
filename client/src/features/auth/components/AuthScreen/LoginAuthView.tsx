import { useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { classNames } from '../../../../utils/classNames'
import { LanguageSwitcher } from '../../../../components/ui/LanguageSwitcher'
import { ThemeSwitcher } from '../../../../components/ui/ThemeSwitcher'
import { useI18n } from '../../../../locales/I18nContext'
import type { AuthScreenLogic } from './types'
import { PasswordVisibilityIcon } from './PasswordVisibilityIcon'
import { useHomeStats } from '../../../home/hooks/useHomeStats'
import styles from '../../styles/LoginAuthView.module.css'

interface LoginAuthViewProps {
  logic: AuthScreenLogic
}

export function LoginAuthView({ logic }: LoginAuthViewProps) {
  const location = useLocation()
  const { locale } = useI18n()
  const homeStats = useHomeStats()
  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        notation: 'compact',
        maximumFractionDigits: 1,
      }),
    [locale]
  )

  const {
    t,
    values,
    setValues,
    errors,
    setErrors,
    isLoading,
    isLoginPasswordVisible,
    setIsLoginPasswordVisible,
    submitError,
    setSubmitError,
    heading,
    description,
    submitLabel,
    validateLoginField,
    handleLogin,
  } = logic

  const shouldShowResetSuccess = new URLSearchParams(location.search).get('reset') === 'success'
  const loginKpis = [
    { labelKey: 'auth.kpi.activeInterns', value: homeStats?.interns ?? null },
    { labelKey: 'auth.kpi.mentorsOnboarded', value: homeStats?.supervisors ?? null },
    { labelKey: 'auth.kpi.totalMissions', value: homeStats?.missions ?? null },
  ] as const

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
              {loginKpis.map((kpi) => (
                <div className={styles.authKpi} key={kpi.labelKey}>
                  <dt className={styles.kpiLabel}>{t(kpi.labelKey)}</dt>
                  <dd className={styles.kpiValue} aria-live="polite">
                    {kpi.value === null ? '—' : numberFormatter.format(kpi.value)}
                  </dd>
                </div>
              ))}
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
              {shouldShowResetSuccess ? (
                <p className={styles.successText} role="status">
                  {t('auth.reset.successLoginPrompt')}
                </p>
              ) : null}
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
                    setSubmitError(null)
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
                <div className={styles.relative}>
                  <input
                    id="password"
                    name="password"
                    type={isLoginPasswordVisible ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={values.password}
                    onChange={(event) => {
                      const nextPassword = event.target.value

                      setValues((previous) => ({ ...previous, password: nextPassword }))
                      setErrors((previous) => ({
                        ...previous,
                        password: validateLoginField('password', nextPassword),
                      }))
                      setSubmitError(null)
                    }}
                    className={classNames(
                      styles.input,
                      styles.inputWithIcon,
                      errors.password && styles.inputError,
                    )}
                    placeholder={t('auth.placeholder.loginPassword')}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setIsLoginPasswordVisible((previous) => !previous)}
                    className={styles.iconButton}
                    aria-label={isLoginPasswordVisible ? t('auth.aria.hidePassword') : t('auth.aria.showPassword')}
                  >
                    <PasswordVisibilityIcon isVisible={isLoginPasswordVisible} className={styles.icon} />
                  </button>
                </div>
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

                <Link className={styles.forgotLink} to="/forgot-password">
                  {t('auth.login.forgotPassword')}
                </Link>
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

              {submitError ? (
                <p className={styles.errorText} role="alert">
                  {submitError}
                </p>
              ) : null}

            </form>

            <p className={styles.bottomText}>
              {t('auth.link.needAccount')}{' '}
              <Link className={styles.linkPrimary} to="/signup">
                {t('auth.action.createAccount')}
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

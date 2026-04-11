import { Link } from 'react-router-dom'
import { LanguageSwitcher } from '../../../components/ui/LanguageSwitcher'
import { ThemeSwitcher } from '../../../components/ui/ThemeSwitcher'
import { PasswordVisibilityIcon } from '../components/AuthScreen/PasswordVisibilityIcon'
import { useForgotPasswordLogic } from '../hooks/useForgotPasswordLogic'
import styles from '../styles/ForgotPasswordPage.module.css'

export function ForgotPasswordPage() {
  const {
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
  } = useForgotPasswordLogic()

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-live="polite">
        <div className={styles.utilityBar}>
          <Link className={styles.backHome} to="/">
            <span aria-hidden="true">&#8592;</span>
            {t('nav.home')}
          </Link>

          <div className={styles.utilityActions}>
            <LanguageSwitcher />
            <ThemeSwitcher />
          </div>
        </div>

        <header className={styles.header}>
          <h1 className={styles.title}>
            {t('auth.reset.title')}
          </h1>
          {step === 'email' ? (
            <p className={styles.description}>{t('auth.reset.description')}</p>
          ) : null}
          {step === 'code' ? (
            <>
              <h2 className={styles.stepTitle}>{t('auth.reset.checkEmail')}</h2>
              <p className={styles.description}>{codeMessage}</p>
            </>
          ) : null}
        </header>

        {step === 'email' ? (
          <form className={styles.form} noValidate onSubmit={handleSendCode}>
            <label className={styles.label} htmlFor="reset-email">
              {t('auth.reset.emailAddress')}
            </label>
            <input
              id="reset-email"
              name="reset-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={styles.input}
              placeholder={t('auth.placeholder.email')}
            />

            <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? (
                <span className={styles.spinner} aria-hidden="true" />
              ) : null}
              {t('auth.reset.sendCode')}
            </button>
          </form>
        ) : null}

        {step === 'code' ? (
          <form className={styles.form} noValidate onSubmit={handleVerifyCode}>
            <label className={styles.label} htmlFor="reset-code">
              {t('auth.reset.codeLabel')}
            </label>
            <input
              id="reset-code"
              name="reset-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => {
                const digitsOnly = event.target.value.replace(/\D/g, '').slice(0, 6)
                setCode(digitsOnly)
              }}
              className={styles.input}
            />

            <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? (
                <span className={styles.spinner} aria-hidden="true" />
              ) : null}
              {t('auth.reset.verifyCode')}
            </button>

            <button
              type="button"
              className={styles.inlineAction}
              onClick={() => {
                void handleResendCode()
              }}
              disabled={isSubmitting || resendCooldown > 0}
            >
              {resendCooldown > 0
                ? t('auth.reset.resendIn').replace('{{seconds}}', String(resendCooldown))
                : t('auth.reset.resendCode')}
            </button>
          </form>
        ) : null}

        {step === 'password' ? (
          <form className={styles.form} noValidate onSubmit={handleResetPassword}>
            <label className={styles.label} htmlFor="new-password">
              {t('auth.reset.newPassword')}
            </label>
            <div className={styles.passwordField}>
              <input
                id="new-password"
                name="new-password"
                type={isPasswordVisible ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className={styles.input}
                placeholder={t('auth.placeholder.passwordMin8')}
              />
              <button
                type="button"
                className={styles.visibilityButton}
                onClick={() => setIsPasswordVisible((current) => !current)}
                aria-label={isPasswordVisible ? t('auth.aria.hidePassword') : t('auth.aria.showPassword')}
              >
                <PasswordVisibilityIcon isVisible={isPasswordVisible} className={styles.visibilityIcon} />
              </button>
            </div>

            <label className={styles.label} htmlFor="confirm-password">
              {t('auth.reset.confirmNewPassword')}
            </label>
            <div className={styles.passwordField}>
              <input
                id="confirm-password"
                name="confirm-password"
                type={isConfirmPasswordVisible ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className={styles.input}
                placeholder={t('auth.placeholder.confirmPassword')}
              />
              <button
                type="button"
                className={styles.visibilityButton}
                onClick={() => setIsConfirmPasswordVisible((current) => !current)}
                aria-label={isConfirmPasswordVisible ? t('auth.aria.hideConfirmPassword') : t('auth.aria.showConfirmPassword')}
              >
                <PasswordVisibilityIcon isVisible={isConfirmPasswordVisible} className={styles.visibilityIcon} />
              </button>
            </div>

            <button type="submit" className={styles.submitButton} disabled={isSubmitting}>
              {isSubmitting ? (
                <span className={styles.spinner} aria-hidden="true" />
              ) : null}
              {t('auth.reset.submit')}
            </button>
          </form>
        ) : null}

        {submitError ? (
          <p className={styles.errorText} role="alert">
            {submitError}
          </p>
        ) : null}

        <footer className={styles.footer}>
          <Link className={styles.backToLogin} to="/login">
            {t('auth.reset.backToLogin')}
          </Link>
        </footer>
      </section>
    </main>
  )
}

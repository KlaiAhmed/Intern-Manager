import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Section } from '../../../components/ui/Section'
import { useI18n } from '../../../locales/I18nContext'
import { useAuth } from '../../../stores/AuthContext'
import { classNames } from '../../../utils/classNames'
import { useHomeStats } from '../hooks/useHomeStats'
import styles from './HeroSection.module.css'

const heroStatDefinitions = [
  { key: 'hero.statSupervisors', field: 'supervisors' },
  { key: 'hero.statInterns', field: 'interns' },
  { key: 'hero.statMissions', field: 'missions' },
] as const

function AnimatedStat({ value, labelKey, delay }: { value: number; labelKey: typeof heroStatDefinitions[number]['key']; delay: number }) {
  const { t, locale } = useI18n()
  const [count, setCount] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        notation: 'compact',
        maximumFractionDigits: 1,
      }),
    [locale]
  )
  const targetValue = Math.max(0, value)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay * 100 + 500)
    return () => clearTimeout(timer)
  }, [delay])

  useEffect(() => {
    if (!isVisible) return

    const duration = 1200
    const steps = 40
    const increment = targetValue / steps
    let currentStep = 0

    setCount(0)

    const timer = setInterval(() => {
      currentStep++
      const nextValue = Math.min(increment * currentStep, targetValue)
      setCount(nextValue)

      if (currentStep >= steps) {
        setCount(targetValue)
        clearInterval(timer)
      }
    }, duration / steps)

    return () => clearInterval(timer)
  }, [isVisible, targetValue])

  return (
    <li className={classNames(styles.heroStatItem, 'reveal-on-scroll')}>
      <strong>{isVisible ? formatter.format(count) : formatter.format(0)}</strong>
      <span>{t(labelKey)}</span>
    </li>
  )
}

export function HeroSection() {
  const { t } = useI18n()
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const homeStats = useHomeStats()

  return (
    <Section className={styles.heroSection}>
      <div className={classNames(styles.heroGrid, 'container')}>
        <div className={styles.heroCopy}>
          <div
            className={styles.heroBadgeWrapper}
          >
            <Badge>{t('hero.badge')}</Badge>
          </div>
          <p className={styles.heroKicker}>Axia</p>
          <h1 className={styles.heroTitle}>{t('hero.title')}</h1>
          <p className={styles.heroDescription}>{t('hero.description')}</p>
          {!isLoggedIn && (
            <div className={styles.heroActions}>
              <Button
                size="md"
                variant="primary"
                onClick={() => navigate('/signup')}
              >
                {t('nav.getStarted')}
              </Button>
              <Button
                size="md"
                variant="secondary"
                onClick={() => navigate('/login')}
              >
                {t('nav.login')}
              </Button>
            </div>
          )}
        </div>

        <aside className={styles.heroPanel} aria-label="Platform impact metrics">
          <ul className={styles.heroStatsList}>
            {heroStatDefinitions.map((stat, index) => (
              <AnimatedStat
                key={stat.key}
                value={homeStats?.[stat.field] ?? 0}
                labelKey={stat.key}
                delay={index}
              />
            ))}
          </ul>
        </aside>
      </div>
    </Section>
  )
}


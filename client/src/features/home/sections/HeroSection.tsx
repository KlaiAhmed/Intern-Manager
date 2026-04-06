import { useNavigate } from 'react-router-dom'
import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Section } from '../../../components/ui/Section'
import { useI18n } from '../../../locales/I18nContext'
import { useAuth } from '../../../stores/AuthContext'
import { useEffect, useState } from 'react'

const heroStats = [
  { key: 'hero.statTeams', value: '24+' },
  { key: 'hero.statInterns', value: '1.8K' },
  { key: 'hero.statCompletion', value: '93%' },
] as const

function AnimatedStat({ value, labelKey, delay }: { value: string; labelKey: typeof heroStats[number]['key']; delay: number }) {
  const { t } = useI18n()
  const [count, setCount] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const numericValue = parseFloat(value.replace(/[^0-9.]/g, ''))
  const suffix = value.replace(/[0-9.]/g, '')

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay * 100 + 500)
    return () => clearTimeout(timer)
  }, [delay])

  useEffect(() => {
    if (!isVisible) return

    const duration = 1200
    const steps = 40
    const increment = numericValue / steps
    let current = 0
    let step = 0

    const timer = setInterval(() => {
      step++
      current = Math.min(increment * step, numericValue)
      setCount(current)

      if (step >= steps) {
        setCount(numericValue)
        clearInterval(timer)
      }
    }, duration / steps)

    return () => clearInterval(timer)
  }, [isVisible, numericValue])

  const displayValue = value.includes('.')
    ? `${count.toFixed(1)}${suffix}`
    : `${Math.round(count)}${suffix}`

  return (
    <li className="hero-stat-item reveal-on-scroll">
      <strong>{isVisible ? displayValue : '0'}</strong>
      <span>{t(labelKey)}</span>
    </li>
  )
}

export function HeroSection() {
  const { t } = useI18n()
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()

  return (
    <Section className="hero-section">
      <div className="hero-grid container">
        <div className="hero-copy">
          <div
            className="hero-badge-wrapper"
          >
            <Badge>{t('hero.badge')}</Badge>
          </div>
          <p className="hero-kicker">Axia</p>
          <h1 className="hero-title">{t('hero.title')}</h1>
          <p className="hero-description">{t('hero.description')}</p>
          {!isLoggedIn && (
            <div className="hero-actions">
              <Button
                size="md"
                variant="primary"
                onClick={() => navigate('/signup')}
                className="hero-cta"
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

        <aside className="hero-panel" aria-label="Platform impact metrics">
          <ul className="hero-stats-list">
            {heroStats.map((stat, index) => (
              <AnimatedStat
                key={stat.key}
                value={stat.value}
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


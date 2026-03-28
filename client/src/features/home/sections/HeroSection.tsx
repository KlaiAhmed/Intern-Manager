import { Badge } from '../../../shared/ui/Badge'
import { Button } from '../../../shared/ui/Button'
import { Section } from '../../../shared/ui/Section'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { useAuth } from '../../../shared/state/AuthContext'

const heroStats = [
  { key: 'hero.statTeams', value: '24+' },
  { key: 'hero.statInterns', value: '1.8K' },
  { key: 'hero.statCompletion', value: '93%' },
] as const

export function HeroSection() {
  const { t } = useI18n()
  const { isLoggedIn } = useAuth()

  return (
    <Section className="hero-section">
      <div className="hero-grid container">
        <div className="hero-copy reveal-on-scroll">
          <Badge>{t('hero.badge')}</Badge>
          <p className="hero-kicker">Axia</p>
          <h2 className="hero-title">{t('hero.title')}</h2>
          <p className="hero-description">{t('hero.description')}</p>
          {!isLoggedIn ? (
            <div className="hero-actions">
              <Button>{t('hero.primaryCta')}</Button>
              <Button variant="secondary">{t('nav.login')}</Button>
            </div>
          ) : null}
        </div>

        <aside className="hero-panel reveal-on-scroll" aria-label="Platform impact metrics">
          <ul className="hero-stats-list">
            {heroStats.map((stat) => (
              <li key={stat.key} className="surface-card hero-stat-item reveal-on-scroll">
                <strong>{stat.value}</strong>
                <span>{t(stat.key)}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </Section>
  )
}

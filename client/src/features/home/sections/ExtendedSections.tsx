import { useNavigate } from 'react-router-dom'
import { useI18n } from '../../../locales/I18nContext'
import { useAuth } from '../../../stores/AuthContext'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import { Section } from '../../../components/ui/Section'
import { classNames } from '../../../utils/classNames'
import styles from './ExtendedSections.module.css'

const proofCards = [
  { quote: 'proof.quote1', author: 'proof.author1', role: 'Training Lead' },
  { quote: 'proof.quote2', author: 'proof.author2', role: 'HR Operations' },
  { quote: 'proof.quote3', author: 'proof.author3', role: 'Program Director' },
] as const

const trustFeatures = [
  {
    key: 'trust.security',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0110 0v4" />
      </svg>
    ),
  },
  {
    key: 'trust.accessibility',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    key: 'trust.performance',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
] as const

const aiFactors = [
  { key: 'ai.factorSkills', icon: '✓' },
  { key: 'ai.factorAvailability', icon: '✓' },
  { key: 'ai.factorPerformance', icon: '✓' },
] as const

export default function ExtendedSections() {
  const { t } = useI18n()
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()

  return (
    <>
      {/* AI Section */}
      <Section id="ai" title={t('ai.title')} subtitle={t('ai.description')}>
        <div className="cards-grid cards-grid-2">
          <Card>
            <div className={styles.aiScoreHeader}>
              <h3>{t('ai.cardScore')}</h3>
              <span className={styles.aiScoreBadge}>87</span>
            </div>
            <div className={styles.aiScoreBar}>
              <div className={classNames(styles.aiScoreProgress, styles.aiScoreProgress87)} />
            </div>
            <p className={styles.aiScoreContext}>
              Based on skill alignment, availability, and historical performance metrics.
            </p>
          </Card>
          <Card>
            <h3>{t('ai.cardExplanation')}</h3>
            <ul className={styles.aiFactorsList}>
              {aiFactors.map((factor) => (
                <li key={factor.key}>
                  <span className={styles.aiFactorCheck} aria-hidden="true">{factor.icon}</span>
                  {t(factor.key)}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </Section>

      {/* BI Section */}
      <Section id="bi" title={t('bi.title')} subtitle={t('bi.description')}>
        <div className="cards-grid cards-grid-3">
          <Card className={styles.biMetricCard}>
            <div className={styles.biMetricHeader}>
              <h3>{t('bi.metricActive')}</h3>
              <span className={styles.biMetricTrend} aria-label="Trending up">
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
                </svg>
              </span>
            </div>
            <p className={styles.metricValue}>124</p>
            <p className={styles.biMetricContext}>Active this quarter</p>
          </Card>
          <Card className={styles.biMetricCard}>
            <div className={styles.biMetricHeader}>
              <h3>{t('bi.metricRisk')}</h3>
              <span className={classNames(styles.biMetricTrend, styles.biMetricTrendDown)} aria-label="Trending down">
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 112 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </span>
            </div>
            <p className={styles.metricValue}>09</p>
            <p className={styles.biMetricContext}>Requiring attention</p>
          </Card>
          <Card className={styles.biMetricCard}>
            <div className={styles.biMetricHeader}>
              <h3>{t('bi.metricSatisfaction')}</h3>
              <span className={styles.biMetricTrend} aria-label="Stable">
                <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
                  <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </span>
            </div>
            <p className={styles.metricValue}>4.7</p>
            <p className={styles.biMetricContext}>Average rating</p>
          </Card>
        </div>
      </Section>

      {/* Trust Section */}
      <Section id="trust" title={t('trust.title')}>
        <div className="cards-grid cards-grid-3">
          {trustFeatures.map((feature) => (
            <Card
              key={feature.key}
              className={styles.trustCard}
            >
              <div className={styles.trustIcon} aria-hidden="true">
                {feature.icon}
              </div>
              <p>{t(feature.key)}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* Proof Section */}
      <Section id="proof" title={t('proof.title')}>
        <div className="cards-grid cards-grid-3">
          {proofCards.map((item) => (
            <Card
              key={item.quote}
              className={styles.testimonialCard}
            >
              <blockquote>
                <p>{t(item.quote)}</p>
              </blockquote>
              <footer className={styles.testimonialFooter}>
                <div className={styles.testimonialAvatar} aria-hidden="true">
                  {t(item.author).charAt(0)}
                </div>
                <div className={styles.testimonialMeta}>
                  <cite className={styles.cardMeta}>{t(item.author)}</cite>
                  <span className={styles.testimonialRole}>{item.role}</span>
                </div>
              </footer>
            </Card>
          ))}
        </div>
      </Section>

      {/* Final CTA Section */}
      {!isLoggedIn && (
        <Section id="cta" className={styles.finalCtaSection}>
          <div className={classNames('surface-card', styles.finalCtaCard)}>
            <h2>{t('cta.title')}</h2>
            <p>{t('cta.text')}</p>
            <div className={styles.ctaActions}>
              <Button
                size="md"
                variant="primary"
                onClick={() => navigate('/signup')}
                className={styles.finalCtaButton}
              >
                {t('nav.getStarted')}
              </Button>
            </div>
          </div>
        </Section>
      )}
    </>
  )
}


import { useI18n } from '../../../shared/i18n/I18nContext'
import { useAuth } from '../../../shared/state/AuthContext'
import { Button } from '../../../shared/ui/Button'
import { Card } from '../../../shared/ui/Card'
import { Section } from '../../../shared/ui/Section'

const proofCards = [
  { quote: 'proof.quote1', author: 'proof.author1' },
  { quote: 'proof.quote2', author: 'proof.author2' },
  { quote: 'proof.quote3', author: 'proof.author3' },
] as const

export default function ExtendedSections() {
  const { t } = useI18n()
  const { isLoggedIn } = useAuth()

  return (
    <>
      <Section id="ai" title={t('ai.title')} subtitle={t('ai.description')}>
        <div className="cards-grid cards-grid-2">
          <Card>
            <h3>{t('ai.cardScore')}</h3>
            <p className="metric-value">87 / 100</p>
          </Card>
          <Card>
            <h3>{t('ai.cardExplanation')}</h3>
            <ul className="list-clean">
              <li>{t('ai.factorSkills')}</li>
              <li>{t('ai.factorAvailability')}</li>
              <li>{t('ai.factorPerformance')}</li>
            </ul>
          </Card>
        </div>
      </Section>

      <Section id="bi" title={t('bi.title')} subtitle={t('bi.description')}>
        <div className="cards-grid cards-grid-3">
          <Card>
            <h3>{t('bi.metricActive')}</h3>
            <p className="metric-value">124</p>
          </Card>
          <Card>
            <h3>{t('bi.metricRisk')}</h3>
            <p className="metric-value">09</p>
          </Card>
          <Card>
            <h3>{t('bi.metricSatisfaction')}</h3>
            <p className="metric-value">4.7 / 5</p>
          </Card>
        </div>
      </Section>

      <Section id="trust" title={t('trust.title')}>
        <div className="cards-grid cards-grid-3">
          <Card>
            <p>{t('trust.security')}</p>
          </Card>
          <Card>
            <p>{t('trust.accessibility')}</p>
          </Card>
          <Card>
            <p>{t('trust.performance')}</p>
          </Card>
        </div>
      </Section>

      <Section id="proof" title={t('proof.title')}>
        <div className="cards-grid cards-grid-3">
          {proofCards.map((item) => (
            <Card key={item.quote}>
              <blockquote>
                <p>{t(item.quote)}</p>
              </blockquote>
              <p className="card-meta">{t(item.author)}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="cta" className="final-cta-section">
        <div className="surface-card final-cta-card">
          <h2>{t('cta.title')}</h2>
          <p>{t('cta.text')}</p>
          {!isLoggedIn ? (
            <div className="hero-actions">
              <Button>{t('cta.primary')}</Button>
              <Button variant="secondary">{t('cta.secondary')}</Button>
            </div>
          ) : null}
        </div>
      </Section>
    </>
  )
}

import { Suspense, lazy } from 'react'
import { useI18n } from '../../../shared/i18n/I18nContext'
import { usePageMetadata } from '../../../shared/seo/usePageMetadata'
import { HeroSection } from '../sections/HeroSection'
import { BenefitsSection } from '../sections/BenefitsSection'
import { RoleValueSection } from '../sections/RoleValueSection'
import { LifecycleSection } from '../sections/LifecycleSection'

const ExtendedSections = lazy(() => import('../sections/ExtendedSections'))

export function HomePage() {
  const { t } = useI18n()

  usePageMetadata({
    title: 'Smart Axia Intern Manager | Internship Lifecycle Platform',
    description:
      'Smart Axia Intern Manager is an enterprise platform for mission assignment, progress tracking, evaluations, AI matching, and BI analytics.',
    path: '/',
  })

  return (
    <main id="main-content" tabIndex={-1}>
      <h1 className="sr-only">Smart Axia Intern Manager</h1>
      <HeroSection />
      <BenefitsSection />
      <RoleValueSection />
      <LifecycleSection />

      <Suspense
        fallback={
          <section className="section">
            <div className="container">
              <div className="surface-card">{t('loading.extended')}</div>
            </div>
          </section>
        }
      >
        <ExtendedSections />
      </Suspense>
    </main>
  )
}

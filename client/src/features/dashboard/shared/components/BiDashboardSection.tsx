import { useCallback, useState, type ReactNode } from 'react'
import { format } from 'date-fns'
import { useI18n } from '@/locales/I18nContext'
import { DashboardButton } from '../../components/DashboardButton'
import { ErrorState } from '../../components/ErrorState'
import { Skeleton } from '../../components/Skeleton'
import { useBiDashboardData } from '../hooks/useBiDashboardData'
import type { BiSectionData } from '../types/biDashboard'
import styles from './BiDashboardSection.module.css'
import { S1_KpiRow } from './sections/S1_KpiRow'
import { S2_InternFunnel } from './sections/S2_InternFunnel'
import { S3_MissionStats } from './sections/S3_MissionStats'
import { S4_EvaluationsSection } from './sections/S4_EvaluationsSection'
import { S5_Demographics } from './sections/S5_Demographics'
import { S6_SupervisorWorkload } from './sections/S6_SupervisorWorkload'
import { S7_Deliverables } from './sections/S7_Deliverables'
import { S8_SystemHealth } from './sections/S8_SystemHealth'
import { S9_ActionQueue } from './sections/S9_ActionQueue'

function SectionStatus<T>({ section }: { section: BiSectionData<T> }) {
  if (section.loading) {
    return (
      <div className={styles.sectionState}>
        <Skeleton height="56px" />
      </div>
    )
  }

  if (section.error) {
    return (
      <div className={styles.sectionState}>
        <ErrorState message={section.error} onRetry={section.refetch} />
      </div>
    )
  }

  return null
}

function renderSection<T>(
  n: number,
  title: string,
  section: BiSectionData<T>,
  children: ReactNode,
  options: { badge?: ReactNode; handlesState?: boolean } = {},
) {
  return (
    <div className={styles.sectionCard} key={n}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionNum}>{n}</span>
        <span className={styles.sectionTitle}>{title}</span>
        {options.badge}
      </div>
      {!options.handlesState && <SectionStatus section={section} />}
      {children}
    </div>
  )
}

export function BiDashboardSection() {
  const { t } = useI18n()
  const dashboardData = useBiDashboardData()
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const { refetchAll } = dashboardData

  const isLoading = [
    dashboardData.kpi,
    dashboardData.funnel,
    dashboardData.missionStats,
    dashboardData.evaluationStats,
    dashboardData.demographics,
    dashboardData.supervisorWorkload,
    dashboardData.deliverableStats,
    dashboardData.systemHealth,
    dashboardData.actionQueue,
  ].some((section) => section.loading)

  const handleRefreshAll = useCallback(() => {
    void refetchAll().then(() => {
      setLastRefreshed(new Date())
    })
  }, [refetchAll])

  return (
    <section className={styles.root}>
      <div className={styles.dashboardHeader}>
        <div className={styles.headerText}>
          <h2 className={styles.title}>{t('dashboard.bi.header.title')}</h2>
          <p className={styles.subtitle}>{t('dashboard.bi.header.subtitle')}</p>
        </div>
        <div className={styles.headerActions}>
          <DashboardButton
            type="button"
            variant="secondary"
            size="sm"
            loading={isLoading}
            onClick={handleRefreshAll}
          >
            {t('dashboard.bi.header.refreshAll')}
          </DashboardButton>
          <span className={styles.refreshTimestamp}>
            {t('dashboard.bi.header.lastRefreshed')}: {lastRefreshed ? format(lastRefreshed, 'HH:mm:ss') : '-'}
          </span>
        </div>
      </div>

      {renderSection(1, t('dashboard.bi.section.kpi'), dashboardData.kpi, <S1_KpiRow data={dashboardData.kpi} />, { handlesState: true })}
      {renderSection(2, t('dashboard.bi.section.funnel'), dashboardData.funnel, <S2_InternFunnel data={dashboardData.funnel} />, { handlesState: true })}
      {renderSection(3, t('dashboard.bi.section.missions'), dashboardData.missionStats, <S3_MissionStats data={dashboardData.missionStats} />, { handlesState: true })}
      {renderSection(4, t('dashboard.bi.section.evaluations'), dashboardData.evaluationStats, <S4_EvaluationsSection data={dashboardData.evaluationStats} />, { handlesState: true })}
      {renderSection(5, t('dashboard.bi.section.demographics'), dashboardData.demographics, <S5_Demographics data={dashboardData.demographics} />, { handlesState: true })}
      {renderSection(6, t('dashboard.bi.section.supervisors'), dashboardData.supervisorWorkload, <S6_SupervisorWorkload data={dashboardData.supervisorWorkload} />, { handlesState: true })}
      {renderSection(7, t('dashboard.bi.section.deliverables'), dashboardData.deliverableStats, <S7_Deliverables data={dashboardData.deliverableStats} />, { handlesState: true })}
      {renderSection(8, t('dashboard.bi.section.system'), dashboardData.systemHealth, <S8_SystemHealth data={dashboardData.systemHealth} />, { handlesState: true })}
      {renderSection(
        9,
        t('dashboard.bi.section.actions'),
        dashboardData.actionQueue,
        <S9_ActionQueue data={dashboardData.actionQueue} />,
        {
          badge: <span className={`${styles.sectionBadge} ${styles.sectionBadgeOperational}`}>{t('dashboard.bi.actions.badge.operational')}</span>,
          handlesState: true,
        },
      )}
    </section>
  )
}

import type { ReactNode } from 'react'
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
  options: { handlesState?: boolean } = {},
) {
  return (
    <div className={styles.sectionCard} key={n}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionNum}>{n}</span>
        <span className={styles.sectionTitle}>{title}</span>
      </div>
      {!options.handlesState && <SectionStatus section={section} />}
      {children}
    </div>
  )
}

export function BiDashboardSection() {
  const dashboardData = useBiDashboardData()

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

  return (
    <section className={styles.root}>
      <div className={styles.topBar}>
        <h2 className={styles.title}>BI Dashboard</h2>
        <DashboardButton
          type="button"
          variant="secondary"
          size="sm"
          loading={isLoading}
          onClick={dashboardData.refetchAll}
        >
          Refresh all
        </DashboardButton>
      </div>

      {renderSection(1, 'KPI Row', dashboardData.kpi, <S1_KpiRow data={dashboardData.kpi} />, { handlesState: true })}
      {renderSection(2, 'Intern Funnel', dashboardData.funnel, <S2_InternFunnel data={dashboardData.funnel} />, { handlesState: true })}
      {renderSection(3, 'Mission Stats', dashboardData.missionStats, <S3_MissionStats data={dashboardData.missionStats} />, { handlesState: true })}
      {renderSection(4, 'Evaluations', dashboardData.evaluationStats, <S4_EvaluationsSection data={dashboardData.evaluationStats} />, { handlesState: true })}
      {renderSection(5, 'Demographics', dashboardData.demographics, <S5_Demographics data={dashboardData.demographics} />, { handlesState: true })}
      {renderSection(6, 'Supervisor Workload', dashboardData.supervisorWorkload, <S6_SupervisorWorkload data={dashboardData.supervisorWorkload} />, { handlesState: true })}
      {renderSection(7, 'Deliverables', dashboardData.deliverableStats, <S7_Deliverables data={dashboardData.deliverableStats} />, { handlesState: true })}
      {renderSection(8, 'System Health', dashboardData.systemHealth, <S8_SystemHealth data={dashboardData.systemHealth} />, { handlesState: true })}
      {renderSection(9, 'Action Queue', dashboardData.actionQueue, <S9_ActionQueue data={dashboardData.actionQueue} />, { handlesState: true })}
    </section>
  )
}

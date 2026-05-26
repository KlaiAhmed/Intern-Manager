import type { CSSProperties } from 'react'
import { useI18n } from '@/locales/I18nContext'
import { ErrorState } from '../../../components/ErrorState'
import { Skeleton } from '../../../components/Skeleton'
import type { BiKpiResponse, BiSectionData } from '../../types/biDashboard'
import styles from '../BiDashboardSection.module.css'

interface Props { data: BiSectionData<BiKpiResponse>; }

type KpiCardStyle = CSSProperties & {
  '--bi-kpi-accent': string
  '--bi-kpi-border': string
}

const skeletonItems = Array.from({ length: 6 }, (_, index) => index)

export function S1_KpiRow({ data }: Props) {
  const { t } = useI18n()

  if (data.loading) {
    return (
      <div className={styles.kpiGrid} aria-busy="true">
        {skeletonItems.map((item) => (
          <Skeleton key={item} height="100px" />
        ))}
      </div>
    )
  }

  if (data.error) {
    return <ErrorState message={data.error} onRetry={data.refetch} />
  }

  if (!data.data) {
    return null
  }

  const pendingVerifications = data.data.pendingVerifications
  const cards = [
    {
      label: t('dashboard.bi.kpi.totalInterns'),
      value: data.data.totalInterns,
      trend: t('dashboard.bi.kpi.activeInternsTrend', { count: data.data.activeInterns }),
      accent: '#378ADD',
    },
    {
      label: t('dashboard.bi.kpi.activeMissions'),
      value: data.data.activeMissions,
      trend: t('dashboard.bi.kpi.totalMissionsTrend', { count: data.data.totalMissions }),
      accent: '#1D9E75',
    },
    {
      label: t('dashboard.bi.kpi.pendingVerifications'),
      value: pendingVerifications,
      trend: pendingVerifications > 0
        ? t('dashboard.bi.kpi.actionNeeded')
        : t('dashboard.bi.kpi.allClear'),
      accent: '#BA7517',
      attention: pendingVerifications > 0,
    },
    {
      label: t('dashboard.bi.kpi.avgEvaluationScore'),
      value: data.data.avgEvaluationScore.toFixed(1),
      trend: t('dashboard.bi.kpi.scoreScale'),
      accent: '#D4537E',
    },
    {
      label: t('dashboard.bi.kpi.supervisorUtilization'),
      value: `${data.data.supervisorUtilization.toFixed(1)}%`,
      trend: t('dashboard.bi.kpi.capacityUsed'),
      accent: '#7F77DD',
    },
    {
      label: t('dashboard.bi.kpi.onboardingCompletion'),
      value: `${data.data.onboardingCompletionRate.toFixed(1)}%`,
      trend: t('dashboard.bi.kpi.registeredInterns'),
      accent: '#639922',
    },
  ]

  return (
    <div className={styles.kpiGrid}>
      {cards.map((card) => {
        const cardStyle: KpiCardStyle = {
          '--bi-kpi-accent': card.accent,
          '--bi-kpi-border': card.attention ? card.accent : 'var(--dash-border, var(--color-border))',
        }

        return (
          <article className={styles.kpiCard} key={card.label} style={cardStyle}>
            <span className={styles.kpiAccent} aria-hidden="true" />
            <div className={styles.kpiContent}>
              <h3 className={styles.kpiLabel}>{card.label}</h3>
              <div className={styles.kpiValue}>{card.value}</div>
              <p className={styles.kpiTrend}>{card.trend}</p>
            </div>
          </article>
        )
      })}
    </div>
  )
}

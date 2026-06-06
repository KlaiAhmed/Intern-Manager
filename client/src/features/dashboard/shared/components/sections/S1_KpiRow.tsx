import type { CSSProperties } from 'react'
import { useI18n } from '@/locales/I18nContext'
import { ErrorState } from '../../../components/ErrorState'
import { Skeleton } from '../../../components/Skeleton'
import type { BiKpiResponse, BiSectionData } from '../../types/biDashboard'
import { formatNumberValue } from '../../utils/chartFormatters'
import styles from '../BiDashboardSection.module.css'

interface Props { data: BiSectionData<BiKpiResponse>; }

const skeletonItems = Array.from({ length: 5 }, (_, index) => index)

export function S1_KpiRow({ data }: Props) {
  const { t } = useI18n()

  if (data.loading) {
    return (
      <div className={`${styles.kpiGrid} ${styles.grid5}`} aria-busy="true">
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
      value: formatNumberValue(data.data.totalInterns),
      trend: t('dashboard.bi.kpi.activeInternsTrend', { count: formatNumberValue(data.data.activeInterns) }),
      accent: '#378ADD',
    },
    {
      label: t('dashboard.bi.kpi.activeMissions'),
      value: formatNumberValue(data.data.activeMissions),
      trend: t('dashboard.bi.kpi.ofTotal', { total: formatNumberValue(data.data.totalMissions) }),
      accent: '#1D9E75',
    },
    {
      label: t('dashboard.bi.kpi.pendingVerif'),
      value: formatNumberValue(pendingVerifications),
      trend: pendingVerifications > 0
        ? t('dashboard.bi.kpi.actionNeeded')
        : t('dashboard.bi.kpi.allClear'),
      accent: '#BA7517',
      attention: pendingVerifications > 0,
    },
    {
      label: t('dashboard.bi.kpi.avgScore'),
      value: data.data.avgEvaluationScore.toFixed(1),
      trend: t('dashboard.bi.kpi.scoreScale'),
      accent: '#D4537E',
    },
    {
      label: t('dashboard.bi.kpi.onboarding'),
      value: `${data.data.onboardingCompletionRate.toFixed(1)}%`,
      trend: t('dashboard.bi.kpi.ofRegistered'),
      accent: '#639922',
    },
  ]

  return (
    <div className={`${styles.kpiGrid} ${styles.grid5}`}>
      {cards.map((card) => {
        const attentionTextStyle: CSSProperties | undefined = card.attention
          ? { color: card.accent }
          : undefined

        return (
          <article className={styles.kpiCard} key={card.label}>
            <span className={styles.kpiAccent} aria-hidden="true" />
            <div className={styles.kpiContent}>
              <h3 className={styles.kpiLabel}>{card.label}</h3>
              <div className={styles.kpiValue} style={attentionTextStyle}>{card.value}</div>
              <p className={styles.kpiTrend} style={attentionTextStyle}>{card.trend}</p>
            </div>
          </article>
        )
      })}
    </div>
  )
}

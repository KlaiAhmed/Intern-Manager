import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useI18n } from '@/locales/I18nContext'
import { ErrorState } from '../../../components/ErrorState'
import { Skeleton } from '../../../components/Skeleton'
import type { BiSectionData, BiSupervisorWorkloadResponse } from '../../types/biDashboard'
import { formatNumberValue, formatPercentTooltip } from '../../utils/chartFormatters'
import styles from '../BiDashboardSection.module.css'

interface Props { data: BiSectionData<BiSupervisorWorkloadResponse>; }

const UTILIZATION_GREEN = '#1D9E75'
const UTILIZATION_AMBER = '#BA7517'
const UTILIZATION_RED = '#E05050'

function getUtilizationColor(value: number) {
  if (value < 70) {
    return UTILIZATION_GREEN
  }

  if (value < 90) {
    return UTILIZATION_AMBER
  }

  return UTILIZATION_RED
}

export function S6_SupervisorWorkload({ data }: Props) {
  const { t } = useI18n()

  if (data.loading) {
    return <Skeleton height="320px" />
  }

  if (data.error) {
    return <ErrorState message={data.error} onRetry={data.refetch} />
  }

  if (!data.data) {
    return <div className={styles.emptyState}>{t('dashboard.bi.supervisor.noData')}</div>
  }

  const supervisors = data.data.supervisors.map((supervisor) => ({
    ...supervisor,
    remainingCapacity: Math.max(0, 100 - supervisor.utilization),
  }))

  return (
    <div className={`${styles.sectionGrid} ${styles.grid2} ${styles.twoColumnWide}`} aria-busy={data.loading}>
      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>{t('dashboard.bi.supervisor.chartTitle')}</h3>
          <p className={styles.panelNote}>{t('dashboard.bi.supervisor.chartSub')}</p>
        </div>

        {supervisors.length > 0 ? (
          <div className={styles.chartFrame}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={supervisors}
                layout="vertical"
                margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip formatter={formatPercentTooltip} />
                <Legend />
                <ReferenceLine
                  x={80}
                  stroke={UTILIZATION_AMBER}
                  strokeDasharray="4 2"
                  label={{ value: '80%', position: 'insideTopRight', fontSize: 11 }}
                />
                <Bar dataKey="utilization" name={t('dashboard.bi.supervisor.assigned')} stackId="a" radius={[3, 0, 0, 3]}>
                  {supervisors.map((supervisor) => (
                    <Cell key={supervisor.id} fill={getUtilizationColor(supervisor.utilization)} />
                  ))}
                </Bar>
                <Bar
                  dataKey="remainingCapacity"
                  name={t('dashboard.bi.supervisor.remaining')}
                  stackId="a"
                  fill="#E5E7EB"
                  radius={[0, 3, 3, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.emptyState}>{t('dashboard.bi.supervisor.noSupervisors')}</div>
        )}
      </article>

      <aside className={styles.statStack} aria-label={t('dashboard.bi.supervisor.chartTitle')}>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>{t('dashboard.bi.supervisor.overallUtil')}</span>
          <strong className={styles.statValue}>{data.data.overallUtilization.toFixed(1)}%</strong>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>{t('dashboard.bi.supervisor.overCapacity')}</span>
          <strong className={styles.statValue}>{formatNumberValue(data.data.overCapacityCount)}</strong>
          <span className={styles.statSubtitle}>{t('dashboard.bi.supervisor.supervisors')}</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>{t('dashboard.bi.supervisor.unassigned')}</span>
          <strong className={styles.statValue}>{formatNumberValue(data.data.unassignedInterns)}</strong>
        </div>
      </aside>
    </div>
  )
}

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useI18n } from '@/locales/I18nContext'
import { ErrorState } from '../../../components/ErrorState'
import { Skeleton } from '../../../components/Skeleton'
import type { BiMissionStatsResponse, BiSectionData } from '../../types/biDashboard'
import {
  formatMonthLabel,
  formatNumberTooltip,
  formatNumberValue,
  formatPercentTooltip,
} from '../../utils/chartFormatters'
import styles from '../BiDashboardSection.module.css'

interface Props { data: BiSectionData<BiMissionStatsResponse>; }

const skeletonItems = Array.from({ length: 4 }, (_, index) => index)

function formatPercentTick(value: string | number) {
  return `${value}%`
}

export function S3_MissionStats({ data }: Props) {
  const { t } = useI18n()

  if (data.loading) {
    return (
      <div className={`${styles.sectionGrid} ${styles.grid3}`} aria-busy="true">
        {skeletonItems.map((item) => (
          <Skeleton key={item} height="280px" />
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

  if (data.data.byStatus.length === 0 || data.data.timeline.length === 0) {
    return (
      <article className={styles.chartPanel}>
        <div className={`${styles.emptyState} ${styles.chartEmptyState}`}>No mission data available</div>
      </article>
    )
  }

  return (
    <div className={styles.stack}>
      <div className={`${styles.sectionGrid} ${styles.grid3}`}>
        <article className={styles.chartPanel}>
          <h3 className={styles.panelTitle}>{t('dashboard.bi.missions.timeline')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.data.timeline}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickFormatter={formatMonthLabel} />
              <YAxis />
              <Tooltip formatter={formatNumberTooltip} labelFormatter={formatMonthLabel} />
              <Legend />
              <Area
                type="monotone"
                dataKey="created"
                name={t('dashboard.bi.missions.created')}
                stroke="#378ADD"
                fill="#378ADD"
                fillOpacity={0.2}
              />
              <Area
                type="monotone"
                dataKey="completed"
                name={t('dashboard.bi.missions.completed')}
                stroke="#1D9E75"
                fill="#1D9E75"
                fillOpacity={0.2}
              />
              <Area
                type="monotone"
                dataKey="cancelled"
                name={t('dashboard.bi.missions.cancelled')}
                stroke="#E05050"
                fill="#E05050"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </article>

        <article className={styles.chartPanel}>
          <h3 className={styles.panelTitle}>{t('dashboard.bi.missions.byStatus')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.data.byStatus}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip formatter={formatNumberTooltip} />
              <Bar dataKey="value" fill="#1D9E75" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className={styles.chartPanel}>
          <h3 className={styles.panelTitle}>{t('dashboard.bi.missions.byType')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart layout="vertical" data={data.data.byType}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <YAxis type="category" dataKey="name" width={120} />
              <XAxis type="number" allowDecimals={false} />
              <Tooltip formatter={formatNumberTooltip} />
              <Bar dataKey="value" fill="#378ADD" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>

        <article className={styles.chartPanel}>
          <h3 className={styles.panelTitle}>{t('dashboard.bi.missions.completionRate')}</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.data.completionRateByMonth}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tickFormatter={formatMonthLabel} />
              <YAxis domain={[0, 100]} tickFormatter={formatPercentTick} />
              <Tooltip formatter={formatPercentTooltip} labelFormatter={formatMonthLabel} />
              <Line
                type="monotone"
                dataKey="rate"
                name={t('dashboard.bi.missions.rate')}
                stroke="#1D9E75"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </article>
      </div>

      <div className={styles.statChips}>
        <span className={styles.statChip}>
          {t('dashboard.bi.missions.avgDuration', { count: data.data.avgDurationDays.toFixed(0) })}
        </span>
        <span className={styles.statChip}>
          {t('dashboard.bi.missions.currentlyActive', { count: formatNumberValue(data.data.totalActive) })}
        </span>
      </div>
    </div>
  )
}

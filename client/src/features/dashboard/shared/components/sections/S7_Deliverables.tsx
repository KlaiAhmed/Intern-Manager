import { format } from 'date-fns'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useI18n } from '@/locales/I18nContext'
import { ErrorState } from '../../../components/ErrorState'
import { Skeleton } from '../../../components/Skeleton'
import type { ChartDataPoint, BiDeliverableStatsResponse, BiSectionData } from '../../types/biDashboard'
import { formatNumberTooltip } from '../../utils/chartFormatters'
import styles from '../BiDashboardSection.module.css'

interface Props { data: BiSectionData<BiDeliverableStatsResponse>; }

type LocalizedChartDataPoint = ChartDataPoint & {
  colorKey: string
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#BA7517',
  submitted: '#378ADD',
  accepted: '#1D9E75',
  rejected: '#E05050',
}

function getStatusColor(status: string) {
  return STATUS_COLORS[status.toLowerCase()] ?? '#999999'
}

function hasPositiveValues(items: ChartDataPoint[]) {
  return items.some((item) => item.value > 0)
}

function formatDateLabel(value: unknown, pattern: string) {
  const rawValue = String(value)
  const date = new Date(rawValue)

  if (Number.isNaN(date.getTime())) {
    return rawValue
  }

  return format(date, pattern)
}

export function S7_Deliverables({ data }: Props) {
  const { t } = useI18n()

  if (data.loading) {
    return (
      <div className={`${styles.sectionGrid} ${styles.grid3}`} aria-busy="true">
        <Skeleton height="280px" />
        <Skeleton height="280px" />
        <Skeleton height="280px" />
      </div>
    )
  }

  if (data.error) {
    return <ErrorState message={data.error} onRetry={data.refetch} />
  }

  if (!data.data) {
    return <div className={styles.emptyState}>{t('dashboard.bi.deliverables.noData')}</div>
  }

  const statusLabels: Record<string, string> = {
    pending: t('dashboard.bi.deliverables.status.pending'),
    submitted: t('dashboard.bi.deliverables.status.submitted'),
    accepted: t('dashboard.bi.deliverables.status.accepted'),
    rejected: t('dashboard.bi.deliverables.status.rejected'),
  }
  const statusData: LocalizedChartDataPoint[] = data.data.byStatus.map((item) => ({
    ...item,
    colorKey: item.name,
    name: statusLabels[item.name.toLowerCase()] ?? item.name,
  }))
  const submissionsByWeek = data.data.submissionsByWeek
  const journalActivity = data.data.journalActivityByDay
  const recentJournalActivity = journalActivity.slice(-30)
  const journalInterval = Math.max(0, Math.floor(journalActivity.length / 6))

  return (
    <div className={`${styles.sectionGrid} ${styles.grid3}`} aria-busy={data.loading}>
      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>{t('dashboard.bi.deliverables.statusTitle')}</h3>
        </div>

        {statusData.length > 0 && hasPositiveValues(statusData) ? (
          <div className={styles.chartFrame}>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={2}
                >
                  {statusData.map((entry) => (
                    <Cell key={`${entry.colorKey}-${entry.name}`} fill={getStatusColor(entry.colorKey)} />
                  ))}
                </Pie>
                <Tooltip formatter={formatNumberTooltip} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.emptyState}>{t('dashboard.bi.deliverables.noStatus')}</div>
        )}

        {data.data.overdueCount > 0 && (
          <span className={styles.warningChip}>
            {t('dashboard.bi.deliverables.overdue', { count: data.data.overdueCount.toLocaleString() })}
          </span>
        )}
      </article>

      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>{t('dashboard.bi.deliverables.weekTitle')}</h3>
        </div>

        {submissionsByWeek.length > 0 ? (
          <div className={styles.chartFrame}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={submissionsByWeek} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={formatNumberTooltip} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="submitted"
                  name={t('dashboard.intern.submitted')}
                  stackId="a"
                  stroke="#378ADD"
                  fill="#378ADD"
                  fillOpacity={0.7}
                />
                <Area
                  type="monotone"
                  dataKey="accepted"
                  name={t('dashboard.intern.accepted')}
                  stackId="a"
                  stroke="#1D9E75"
                  fill="#1D9E75"
                  fillOpacity={0.7}
                />
                <Area
                  type="monotone"
                  dataKey="rejected"
                  name={t('dashboard.intern.rejected')}
                  stackId="a"
                  stroke="#E05050"
                  fill="#E05050"
                  fillOpacity={0.7}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.emptyState}>{t('dashboard.bi.deliverables.noWeekly')}</div>
        )}
      </article>

      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>{t('dashboard.bi.deliverables.journalTitle')}</h3>
          <p className={styles.panelNote}>{t('dashboard.bi.deliverables.journalSub')}</p>
        </div>

        {journalActivity.length > 0 ? (
          <div className={styles.chartFrame}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={recentJournalActivity} margin={{ top: 12, right: 12, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => formatDateLabel(value, 'MMM d')}
                  interval={journalInterval}
                  tick={{ fontSize: 10 }}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={formatNumberTooltip} labelFormatter={(value) => formatDateLabel(value, 'PPP')} />
                <Bar dataKey="count" fill="#639922" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.emptyState}>{t('dashboard.bi.deliverables.noJournal')}</div>
        )}
      </article>
    </div>
  )
}

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
import { ErrorState } from '../../../components/ErrorState'
import { Skeleton } from '../../../components/Skeleton'
import type { ChartDataPoint, BiDeliverableStatsResponse, BiSectionData } from '../../types/biDashboard'
import styles from '../BiDashboardSection.module.css'

interface Props { data: BiSectionData<BiDeliverableStatsResponse>; }

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
  if (data.loading) {
    return (
      <div className={`${styles.sectionGrid} ${styles.threeColumn}`} aria-busy="true">
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
    return <div className={styles.emptyState}>No deliverable data available.</div>
  }

  const statusData = data.data.byStatus
  const submissionsByWeek = data.data.submissionsByWeek
  const journalActivity = data.data.journalActivityByDay
  const recentJournalActivity = journalActivity.slice(-30)
  const journalInterval = Math.max(0, Math.floor(journalActivity.length / 6))

  return (
    <div className={`${styles.sectionGrid} ${styles.threeColumn}`} aria-busy={data.loading}>
      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>Deliverable status</h3>
        </div>

        {statusData.length > 0 && hasPositiveValues(statusData) ? (
          <div className={styles.chartFrame} style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
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
                    <Cell key={entry.name} fill={getStatusColor(entry.name)} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.emptyState}>No deliverable statuses found.</div>
        )}

        {data.data.overdueCount > 0 && (
          <span className={styles.warningChip}>⚠ {data.data.overdueCount} overdue</span>
        )}
      </article>

      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>Submission rate by week</h3>
        </div>

        {submissionsByWeek.length > 0 ? (
          <div className={styles.chartFrame} style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={submissionsByWeek} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="submitted"
                  stackId="a"
                  stroke="#378ADD"
                  fill="#378ADD"
                  fillOpacity={0.7}
                />
                <Area
                  type="monotone"
                  dataKey="accepted"
                  stackId="a"
                  stroke="#1D9E75"
                  fill="#1D9E75"
                  fillOpacity={0.7}
                />
                <Area
                  type="monotone"
                  dataKey="rejected"
                  stackId="a"
                  stroke="#E05050"
                  fill="#E05050"
                  fillOpacity={0.7}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.emptyState}>No weekly submissions found.</div>
        )}
      </article>

      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>Journal activity</h3>
          <p className={styles.panelNote}>Journal entries per day (last 90 days)</p>
        </div>

        {recentJournalActivity.length > 0 ? (
          <div className={styles.chartFrame} style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={recentJournalActivity} margin={{ top: 12, right: 12, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => formatDateLabel(value, 'MMM d')}
                  interval={journalInterval}
                  tick={{ fontSize: 10 }}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip labelFormatter={(value) => formatDateLabel(value, 'PPP')} />
                <Bar dataKey="count" fill="#639922" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.emptyState}>No journal activity found.</div>
        )}
      </article>
    </div>
  )
}

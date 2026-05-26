import { format } from 'date-fns'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ErrorState } from '../../../components/ErrorState'
import { Skeleton } from '../../../components/Skeleton'
import type { BiSectionData, BiSystemHealthResponse } from '../../types/biDashboard'
import styles from '../BiDashboardSection.module.css'

interface Props { data: BiSectionData<BiSystemHealthResponse>; }

function formatDateLabel(value: unknown, pattern: string) {
  const rawValue = String(value)
  const date = new Date(rawValue)

  if (Number.isNaN(date.getTime())) {
    return rawValue
  }

  return format(date, pattern)
}

export function S8_SystemHealth({ data }: Props) {
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
    return <div className={styles.emptyState}>No system health data available.</div>
  }

  const userGrowth = data.data.userGrowthByMonth
  const auditLog = data.data.auditLogByDay
  const auditAverage = auditLog.length > 0
    ? auditLog.reduce((sum, entry) => sum + entry.count, 0) / auditLog.length
    : null
  const auditActions = data.data.auditByAction

  return (
    <div className={`${styles.sectionGrid} ${styles.threeColumn}`} aria-busy={data.loading}>
      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>User growth</h3>
        </div>

        {userGrowth.length > 0 ? (
          <div className={styles.chartFrame} style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={userGrowth} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="interns"
                  stackId="a"
                  stroke="#378ADD"
                  fill="#378ADD"
                  fillOpacity={0.72}
                />
                <Area
                  type="monotone"
                  dataKey="supervisors"
                  stackId="a"
                  stroke="#1D9E75"
                  fill="#1D9E75"
                  fillOpacity={0.72}
                />
                <Area
                  type="monotone"
                  dataKey="admins"
                  stackId="a"
                  stroke="#7F77DD"
                  fill="#7F77DD"
                  fillOpacity={0.72}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.emptyState}>No user growth data found.</div>
        )}
      </article>

      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>Audit log volume</h3>
        </div>

        {auditLog.length > 0 ? (
          <div className={styles.chartFrame} style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={auditLog} margin={{ top: 12, right: 24, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) => formatDateLabel(value, 'MMM d')}
                  interval={4}
                  tick={{ fontSize: 10 }}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip labelFormatter={(value) => formatDateLabel(value, 'PPP')} />
                {auditAverage !== null && (
                  <ReferenceLine
                    y={auditAverage}
                    stroke="#D4537E"
                    strokeDasharray="3 3"
                    label={{ value: 'avg', position: 'right', fontSize: 11 }}
                  />
                )}
                <Line dataKey="count" stroke="#7F77DD" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.emptyState}>No audit events found.</div>
        )}
      </article>

      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>Top audit actions</h3>
        </div>

        {auditActions.length > 0 ? (
          <div className={styles.chartFrame} style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={auditActions}
                layout="vertical"
                margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#7F77DD" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.emptyState}>No audit actions found.</div>
        )}

        <div className={`${styles.statBox} ${styles.activeSessionsBox}`} style={{ borderLeftColor: '#378ADD' }}>
          <span className={styles.statLabel}>Active Sessions</span>
          <strong className={styles.statValue}>{data.data.activeSessionsCount}</strong>
          <span className={styles.statSubtitle}>Refresh tokens currently live</span>
        </div>
      </article>
    </div>
  )
}

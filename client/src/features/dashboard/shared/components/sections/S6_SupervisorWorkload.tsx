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
import { ErrorState } from '../../../components/ErrorState'
import { Skeleton } from '../../../components/Skeleton'
import type { BiSectionData, BiSupervisorWorkloadResponse } from '../../types/biDashboard'
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

function formatPercentTooltip(value: unknown, name: unknown) {
  const numericValue = typeof value === 'number' ? value : Number(value)
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0

  return [`${safeValue.toFixed(1)}%`, String(name)]
}

export function S6_SupervisorWorkload({ data }: Props) {
  if (data.loading) {
    return <Skeleton height="320px" />
  }

  if (data.error) {
    return <ErrorState message={data.error} onRetry={data.refetch} />
  }

  if (!data.data) {
    return <div className={styles.emptyState}>No supervisor workload data available.</div>
  }

  const supervisors = data.data.supervisors.map((supervisor) => ({
    ...supervisor,
    remainingCapacity: Math.max(0, 100 - supervisor.utilization),
  }))
  const chartHeight = Math.max(280, supervisors.length * 44)
  const overallColor = getUtilizationColor(data.data.overallUtilization)
  const overCapacityColor = data.data.overCapacityCount > 0 ? UTILIZATION_RED : UTILIZATION_GREEN
  const unassignedColor = data.data.unassignedInterns > 0 ? UTILIZATION_AMBER : UTILIZATION_GREEN

  return (
    <div className={`${styles.sectionGrid} ${styles.twoColumnWide}`} aria-busy={data.loading}>
      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>Supervisor utilization</h3>
          <p className={styles.panelNote}>Assigned workload against available capacity.</p>
        </div>

        {supervisors.length > 0 ? (
          <div className={styles.chartFrame} style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
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
                <Bar dataKey="utilization" name="Assigned" stackId="a" radius={[3, 0, 0, 3]}>
                  {supervisors.map((supervisor) => (
                    <Cell key={supervisor.id} fill={getUtilizationColor(supervisor.utilization)} />
                  ))}
                </Bar>
                <Bar
                  dataKey="remainingCapacity"
                  name="Remaining capacity"
                  stackId="a"
                  fill="#E5E7EB"
                  radius={[0, 3, 3, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.emptyState}>No supervisors found.</div>
        )}
      </article>

      <aside className={styles.statStack} aria-label="Supervisor workload summary">
        <div className={styles.statBox} style={{ borderLeftColor: overallColor }}>
          <span className={styles.statLabel}>Overall Utilization</span>
          <strong className={styles.statValue}>{data.data.overallUtilization.toFixed(1)}%</strong>
        </div>
        <div className={styles.statBox} style={{ borderLeftColor: overCapacityColor }}>
          <span className={styles.statLabel}>Over Capacity</span>
          <strong className={styles.statValue}>{data.data.overCapacityCount}</strong>
          <span className={styles.statSubtitle}>supervisors</span>
        </div>
        <div className={styles.statBox} style={{ borderLeftColor: unassignedColor }}>
          <span className={styles.statLabel}>Unassigned Active Interns</span>
          <strong className={styles.statValue}>{data.data.unassignedInterns}</strong>
        </div>
      </aside>
    </div>
  )
}

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { ErrorState } from '../../../components/ErrorState'
import { Skeleton } from '../../../components/Skeleton'
import type { ChartDataPoint, BiInternFunnelResponse, BiSectionData } from '../../types/biDashboard'
import styles from '../BiDashboardSection.module.css'

interface Props { data: BiSectionData<BiInternFunnelResponse>; }

const VERIFICATION_COLORS: Record<string, string> = {
  active: '#1D9E75',
  pending: '#BA7517',
  incomplete: '#6B7280',
  not_applicable: '#D1D5DB',
}

const WORK_PREFERENCE_COLORS: Record<string, string> = {
  remote: '#378ADD',
  hybrid: '#7F77DD',
  onsite: '#1D9E75',
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_')
}

function getVerificationColor(name: string) {
  return VERIFICATION_COLORS[normalizeKey(name)] ?? '#999999'
}

function getWorkPreferenceColor(name: string) {
  return WORK_PREFERENCE_COLORS[normalizeKey(name)] ?? '#999999'
}

function hasPositiveValues(items: ChartDataPoint[]) {
  return items.some((item) => item.value > 0)
}

function getWidthPercentage(value: number, firstValue: number) {
  if (firstValue <= 0) {
    return 0
  }

  return Math.max(0, Math.min(100, (value / firstValue) * 100))
}

function getDropOffPercentage(currentValue: number, nextValue: number) {
  if (currentValue <= 0) {
    return 0
  }

  return Math.max(0, ((currentValue - nextValue) / currentValue) * 100)
}

function DonutChart({
  data,
  title,
  getColor,
}: {
  data: ChartDataPoint[]
  title: string
  getColor: (name: string) => string
}) {
  return (
    <article className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>{title}</h3>
      </div>

      {data.length > 0 && hasPositiveValues(data) ? (
        <div className={styles.chartFrame} style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={getColor(entry.name)} />
                ))}
              </Pie>
              <Tooltip />
              <Legend layout="horizontal" verticalAlign="bottom" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className={styles.emptyState}>No {title.toLowerCase()} data found.</div>
      )}
    </article>
  )
}

export function S2_InternFunnel({ data }: Props) {
  if (data.loading) {
    return <Skeleton height="320px" />
  }

  if (data.error) {
    return <ErrorState message={data.error} onRetry={data.refetch} />
  }

  if (!data.data) {
    return <div className={styles.emptyState}>No intern funnel data available.</div>
  }

  const funnel = data.data.funnel
  const firstStageValue = funnel[0]?.value ?? 0
  const funnelRows = funnel.reduce<Array<(typeof funnel)[number] & { widthPercentage: number }>>((rows, stage) => {
    const rawWidthPercentage = getWidthPercentage(stage.value, firstStageValue)
    const previousRenderedWidth = rows.at(-1)?.widthPercentage ?? 100
    const widthPercentage = Math.min(rawWidthPercentage, previousRenderedWidth)

    return [
      ...rows,
      {
        ...stage,
        widthPercentage,
      },
    ]
  }, [])

  return (
    <div className={`${styles.sectionGrid} ${styles.twoColumnFunnel}`} aria-busy={data.loading}>
      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>Pipeline funnel</h3>
        </div>

        {funnel.length > 0 && firstStageValue > 0 ? (
          <div className={styles.funnelRows}>
            {funnelRows.map((stage, index) => {
              const nextStage = funnel[index + 1]
              const dropOff = nextStage ? getDropOffPercentage(stage.value, nextStage.value) : 0

              return (
                <div key={stage.stage}>
                  <div
                    className={styles.funnelRow}
                    style={{
                      width: `${stage.widthPercentage}%`,
                      opacity: Math.min(1, 0.5 + index * 0.1),
                    }}
                  >
                    <span className={styles.funnelLabel}>{stage.stage}</span>
                    <span className={styles.funnelValue}>{stage.value.toLocaleString()}</span>
                  </div>
                  {index < funnel.length - 1 && (
                    <div className={styles.dropOff}>↓ {dropOff.toFixed(1)}% drop-off</div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>No funnel stages found.</div>
        )}
      </article>

      <div className={styles.donutStack}>
        <DonutChart
          data={data.data.byVerificationStatus}
          title="Verification Status"
          getColor={getVerificationColor}
        />
        <DonutChart
          data={data.data.byWorkPreference}
          title="Work Preference"
          getColor={getWorkPreferenceColor}
        />
      </div>
    </div>
  )
}

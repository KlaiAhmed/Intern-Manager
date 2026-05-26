import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { useI18n } from '@/locales/I18nContext'
import { ErrorState } from '../../../components/ErrorState'
import { Skeleton } from '../../../components/Skeleton'
import type { ChartDataPoint, BiInternFunnelResponse, BiSectionData } from '../../types/biDashboard'
import { formatNumberTooltip } from '../../utils/chartFormatters'
import styles from '../BiDashboardSection.module.css'

interface Props { data: BiSectionData<BiInternFunnelResponse>; }

type LocalizedChartDataPoint = ChartDataPoint & {
  colorKey: string
}

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
  emptyMessage,
  getColor,
}: {
  data: LocalizedChartDataPoint[]
  title: string
  emptyMessage: string
  getColor: (name: string) => string
}) {
  return (
    <article className={styles.panel}>
      <div className={styles.panelHeader}>
        <h3 className={styles.panelTitle}>{title}</h3>
      </div>

      {data.length > 0 && hasPositiveValues(data) ? (
        <div className={styles.chartFrame} style={{ height: 210 }}>
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
                  <Cell key={`${entry.colorKey}-${entry.name}`} fill={getColor(entry.colorKey)} />
                ))}
              </Pie>
              <Tooltip formatter={formatNumberTooltip} />
              <Legend layout="horizontal" verticalAlign="bottom" />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className={styles.emptyState}>{emptyMessage}</div>
      )}
    </article>
  )
}

export function S2_InternFunnel({ data }: Props) {
  const { t } = useI18n()

  if (data.loading) {
    return <Skeleton height="320px" />
  }

  if (data.error) {
    return <ErrorState message={data.error} onRetry={data.refetch} />
  }

  if (!data.data) {
    return <div className={styles.emptyState}>{t('dashboard.bi.funnel.noData')}</div>
  }

  const funnel = data.data.funnel
  const funnelStageLabels: Record<string, string> = {
    registered: t('dashboard.bi.funnel.stage.registered'),
    profile_started: t('dashboard.bi.funnel.stage.profileStarted'),
    cv_uploaded: t('dashboard.bi.funnel.stage.cvUploaded'),
    pending_verification: t('dashboard.bi.funnel.stage.pendingVerification'),
    verified_active: t('dashboard.bi.funnel.stage.verifiedActive'),
  }
  const verificationStatusLabels: Record<string, string> = {
    active: t('dashboard.bi.funnel.verification.active'),
    pending: t('dashboard.bi.funnel.verification.pending'),
    incomplete: t('dashboard.bi.funnel.verification.incomplete'),
    not_applicable: t('dashboard.bi.funnel.verification.notApplicable'),
  }
  const workPreferenceLabels: Record<string, string> = {
    remote: t('dashboard.bi.funnel.work.remote'),
    hybrid: t('dashboard.bi.funnel.work.hybrid'),
    onsite: t('dashboard.bi.funnel.work.onsite'),
  }
  const verificationStatusData = data.data.byVerificationStatus.map((item) => {
    const normalizedKey = normalizeKey(item.name)

    return {
      ...item,
      colorKey: item.name,
      name: verificationStatusLabels[normalizedKey] ?? item.name,
    }
  })
  const workPreferenceData = data.data.byWorkPreference.map((item) => {
    const normalizedKey = normalizeKey(item.name)

    return {
      ...item,
      colorKey: item.name,
      name: workPreferenceLabels[normalizedKey] ?? item.name,
    }
  })
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
    <div className={`${styles.sectionGrid} ${styles.grid2} ${styles.twoColumnFunnel}`} aria-busy={data.loading}>
      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>{t('dashboard.bi.funnel.title')}</h3>
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
                    <span className={styles.funnelLabel}>
                      {funnelStageLabels[normalizeKey(stage.stage)] ?? stage.stage}
                    </span>
                    <span className={styles.funnelValue}>{stage.value.toLocaleString()}</span>
                  </div>
                  {index < funnel.length - 1 && (
                    <div className={styles.dropOff}>
                      {t('dashboard.bi.funnel.dropOff', { pct: dropOff.toFixed(1) })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <div className={styles.emptyState}>{t('dashboard.bi.funnel.noStages')}</div>
        )}
      </article>

      <div className={styles.donutStack}>
        <DonutChart
          data={verificationStatusData}
          title={t('dashboard.bi.funnel.verifStatus')}
          emptyMessage={t('dashboard.bi.shared.noData')}
          getColor={getVerificationColor}
        />
        <DonutChart
          data={workPreferenceData}
          title={t('dashboard.bi.funnel.workPref')}
          emptyMessage={t('dashboard.bi.shared.noData')}
          getColor={getWorkPreferenceColor}
        />
      </div>
    </div>
  )
}

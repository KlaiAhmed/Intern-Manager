import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useI18n } from '@/locales/I18nContext'
import { ErrorState } from '../../../components/ErrorState'
import { Skeleton } from '../../../components/Skeleton'
import type { BiEvaluationStatsResponse, BiSectionData } from '../../types/biDashboard'
import { formatNumberTooltip } from '../../utils/chartFormatters'
import styles from '../BiDashboardSection.module.css'

interface Props { data: BiSectionData<BiEvaluationStatsResponse>; }

const SCORE_GREEN = styles.scoreBadgeGreen
const SCORE_BLUE = styles.scoreBadgeBlue
const SCORE_AMBER = styles.scoreBadgeAmber
const SCORE_RED = styles.scoreBadgeRed

function safeNumber(value: number) {
  return Number.isFinite(value) ? value : 0
}

function formatScore(value: number, digits = 2) {
  return safeNumber(value).toFixed(digits)
}

function getScoreBadgeClass(score: number) {
  if (score >= 4.5) {
    return `${styles.scoreBadge} ${SCORE_GREEN}`
  }

  if (score >= 3.5) {
    return `${styles.scoreBadge} ${SCORE_BLUE}`
  }

  if (score >= 2.5) {
    return `${styles.scoreBadge} ${SCORE_AMBER}`
  }

  return `${styles.scoreBadge} ${SCORE_RED}`
}

export function S4_EvaluationsSection({ data }: Props) {
  const { t } = useI18n()
  const formatLocalizedScoreTooltip = (value: unknown) => {
    const numericValue = typeof value === 'number' ? value : Number(value)

    return [formatScore(numericValue, 2), t('dashboard.bi.eval.colScore')]
  }

  if (data.loading) {
    return (
      <div className={`${styles.sectionGrid} ${styles.grid3}`} aria-busy="true">
        <Skeleton height="320px" />
        <Skeleton height="320px" />
        <Skeleton height="320px" />
      </div>
    )
  }

  if (data.error) {
    return <ErrorState message={data.error} onRetry={data.refetch} />
  }

  if (!data.data) {
    return <div className={styles.emptyState}>{t('dashboard.bi.eval.noData')}</div>
  }

  const { avgScores, distribution, statusCounts } = data.data
  const radarData = [
    { subject: t('dashboard.bi.eval.technical'), value: safeNumber(avgScores.technical) },
    { subject: t('dashboard.bi.eval.autonomy'), value: safeNumber(avgScores.autonomy) },
    { subject: t('dashboard.bi.eval.communication'), value: safeNumber(avgScores.communication) },
    { subject: t('dashboard.bi.eval.deadlineRespect'), value: safeNumber(avgScores.deadlineRespect) },
    { subject: t('dashboard.bi.eval.deliverableQuality'), value: safeNumber(avgScores.deliverableQuality) },
  ]
  const hasSubmittedScores = radarData.some((score) => score.value > 0)
  const topInterns = data.data.topInterns.slice(0, 10)

  return (
    <div className={`${styles.sectionGrid} ${styles.grid3}`} aria-busy={data.loading}>
      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>{t('dashboard.bi.eval.radarTitle')}</h3>
        </div>

        {hasSubmittedScores ? (
          <>
            <div className={styles.chartFrame}>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  data={radarData}
                  margin={{ top: 18, right: 36, bottom: 18, left: 36 }}
                >
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis angle={90} domain={[0, 5]} tickCount={6} tick={{ fontSize: 10 }} />
                  <Radar
                    name={t('dashboard.bi.eval.colScore')}
                    dataKey="value"
                    stroke="#D4537E"
                    fill="#D4537E"
                    fillOpacity={0.35}
                    strokeWidth={2}
                  />
                  <Tooltip formatter={formatLocalizedScoreTooltip} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            <div className={styles.scoreChips} aria-label={t('dashboard.bi.eval.radarTitle')}>
              {radarData.map((score) => (
                <span className={styles.scoreChip} key={score.subject}>
                  {score.subject}: {formatScore(score.value)}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className={`${styles.emptyState} ${styles.chartEmptyState}`}>
            {t('dashboard.bi.eval.noData')}
          </div>
        )}
      </article>

      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>{t('dashboard.bi.eval.distTitle')}</h3>
        </div>

        {distribution.length > 0 ? (
          <div className={styles.chartFrame}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={distribution} margin={{ top: 24, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={formatNumberTooltip} />
                <Bar dataKey="count" fill="#D4537E" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="count" position="top" style={{ fontSize: 12 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.emptyState}>{t('dashboard.bi.eval.noDist')}</div>
        )}
      </article>

      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>{t('dashboard.bi.eval.topTitle')}</h3>
        </div>

        {topInterns.length > 0 ? (
          <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th scope="col">{t('dashboard.bi.eval.colRank')}</th>
                  <th scope="col">{t('dashboard.bi.eval.colName')}</th>
                  <th scope="col">{t('dashboard.bi.eval.colScore')}</th>
                  <th scope="col">{t('dashboard.bi.eval.colEvals')}</th>
                </tr>
              </thead>
              <tbody>
                {topInterns.map((intern, index) => (
                  <tr key={intern.internId}>
                    <td className={styles.rankCell}>{index + 1}</td>
                    <td className={styles.nameCell}>{intern.name}</td>
                    <td>
                      <span className={getScoreBadgeClass(intern.avgScore)}>
                        {formatScore(intern.avgScore)}
                      </span>
                    </td>
                    <td className={styles.numericCell}>{intern.evaluationCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.emptyState}>{t('dashboard.bi.eval.noRanked')}</div>
        )}

        <div className={styles.statusCounts}>
          <span className={`${styles.statusPill} ${styles.statusPillGreen}`}>
            {t('dashboard.bi.eval.submitted', { count: statusCounts.submitted.toLocaleString() })}
          </span>
          <span className={`${styles.statusPill} ${styles.statusPillAmber}`}>
            {t('dashboard.bi.eval.pendingReview', { count: statusCounts.pending.toLocaleString() })}
          </span>
        </div>
      </article>
    </div>
  )
}

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
import { ErrorState } from '../../../components/ErrorState'
import { Skeleton } from '../../../components/Skeleton'
import type { BiEvaluationStatsResponse, BiSectionData } from '../../types/biDashboard'
import styles from '../BiDashboardSection.module.css'

interface Props { data: BiSectionData<BiEvaluationStatsResponse>; }

const SCORE_GREEN = styles.scoreBadgeGreen
const SCORE_BLUE = styles.scoreBadgeBlue
const SCORE_AMBER = styles.scoreBadgeAmber
const SCORE_RED = styles.scoreBadgeRed

function safeNumber(value: number) {
  return Number.isFinite(value) ? value : 0
}

function formatScore(value: number, digits = 1) {
  return safeNumber(value).toFixed(digits)
}

function formatScoreTooltip(value: unknown) {
  const numericValue = typeof value === 'number' ? value : Number(value)

  return [formatScore(numericValue, 2), 'Score']
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
  if (data.loading) {
    return (
      <div className={`${styles.sectionGrid} ${styles.threeColumn}`} aria-busy="true">
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
    return <div className={styles.emptyState}>No evaluation data available.</div>
  }

  const { avgScores, distribution, statusCounts } = data.data
  const radarData = [
    { subject: 'Technical', value: safeNumber(avgScores.technical) },
    { subject: 'Autonomy', value: safeNumber(avgScores.autonomy) },
    { subject: 'Communication', value: safeNumber(avgScores.communication) },
    { subject: 'Deadline Respect', value: safeNumber(avgScores.deadlineRespect) },
    { subject: 'Deliverable Quality', value: safeNumber(avgScores.deliverableQuality) },
  ]
  const topInterns = data.data.topInterns.slice(0, 10)

  return (
    <div className={`${styles.sectionGrid} ${styles.threeColumn}`} aria-busy={data.loading}>
      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>Average score profile</h3>
        </div>

        <div className={styles.chartFrame} style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
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
                name="Avg Score"
                dataKey="value"
                stroke="#D4537E"
                fill="#D4537E"
                fillOpacity={0.35}
                strokeWidth={2}
              />
              <Tooltip formatter={formatScoreTooltip} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className={styles.scoreChips} aria-label="Average score details">
          {radarData.map((score) => (
            <span className={styles.scoreChip} key={score.subject}>
              {score.subject.split(' ')[0]}: {formatScore(score.value)}
            </span>
          ))}
        </div>
      </article>

      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>Score distribution</h3>
        </div>

        {distribution.length > 0 ? (
          <div className={styles.chartFrame} style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution} margin={{ top: 24, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#D4537E" radius={[4, 4, 0, 0]}>
                  <LabelList dataKey="count" position="top" style={{ fontSize: 12 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.emptyState}>No score distribution found.</div>
        )}
      </article>

      <article className={styles.panel}>
        <div className={styles.panelHeader}>
          <h3 className={styles.panelTitle}>Top 10 interns</h3>
        </div>

        {topInterns.length > 0 ? (
          <div className={styles.tableWrapper}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Name</th>
                  <th scope="col">Avg Score</th>
                  <th scope="col">Evals</th>
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
          <div className={styles.emptyState}>No ranked interns found.</div>
        )}

        <div className={styles.statusCounts}>
          <span className={`${styles.statusPill} ${styles.statusPillGreen}`}>
            Submitted: {statusCounts.submitted}
          </span>
          <span className={`${styles.statusPill} ${styles.statusPillAmber}`}>
            Pending review: {statusCounts.pending}
          </span>
        </div>
      </article>
    </div>
  )
}

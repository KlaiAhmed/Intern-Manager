import { useInternEvaluations } from '../../hooks/intern/useInternEvaluations'
import { toErrorMessage } from '../../shared/utils/errorMessage'
import type { InternEvaluationResponse } from '../../types/intern.types'
import type { TranslateFn } from '../../types/internDashboard'
import { InternTabEmpty, InternTabError, InternTabLoading } from './InternTabStates'

interface EvaluationsTabProps {
  t: TranslateFn
}

const scoreKeys: Array<keyof InternEvaluationResponse['criteria']> = [
  'technical',
  'autonomy',
  'communication',
  'deadlineRespect',
  'deliverableQuality',
]

function formatDate(value: string): string {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)) : '-'
}

function averageScore(evaluation: InternEvaluationResponse): number {
  const values = scoreKeys.map((key) => evaluation.criteria[key])
  return Math.round((values.reduce((sum, score) => sum + score, 0) / values.length) * 10) / 10
}

export function EvaluationsTab({ t }: EvaluationsTabProps) {
  const { evaluations, isLoading, error, refetch } = useInternEvaluations({ pageSize: 20 })

  if (isLoading) {
    return <InternTabLoading label={t('dashboard.intern.tabs.loading')} />
  }

  if (error) {
    return (
      <InternTabError
        title={t('dashboard.intern.tabs.errorTitle')}
        message={toErrorMessage(error, t('dashboard.intern.tabs.errorMessage'))}
        retryLabel={t('dashboard.intern.error.retry')}
        onRetry={refetch}
      />
    )
  }

  if (evaluations.length === 0) {
    return (
      <InternTabEmpty
        title={t('dashboard.intern.evaluations.emptyTitle')}
        message={t('dashboard.intern.evaluations.emptyMessage')}
      />
    )
  }

  return (
    <div className="intern-tab-stack">
      {evaluations.map((evaluation) => (
        <article key={evaluation.id} className="intern-panel">
          <div className="intern-section-header">
            <div>
              <p className="intern-eyebrow">{formatDate(evaluation.date)}</p>
              <h2>{t(`dashboard.intern.evaluations.type.${evaluation.type}`)}</h2>
            </div>
            <span className="intern-score-badge">{averageScore(evaluation)}</span>
          </div>

          <div className="intern-score-grid">
            {scoreKeys.map((scoreKey) => (
              <div key={scoreKey} className="intern-score-row">
                <span>{t(`dashboard.intern.evaluations.score.${scoreKey}`)}</span>
                <strong>{evaluation.criteria[scoreKey]}</strong>
              </div>
            ))}
          </div>

          {evaluation.comments && <p className="intern-evaluation-comment">{evaluation.comments}</p>}
        </article>
      ))}
    </div>
  )
}

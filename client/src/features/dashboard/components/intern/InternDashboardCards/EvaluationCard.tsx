import type { Evaluation, TranslateFn } from '../../../types/internDashboard'

interface EvaluationCardProps {
  evaluations: Evaluation[]
  loading: boolean
  error: string | null
  onRetry: () => void
  t: TranslateFn
}

export function EvaluationCard({
  evaluations,
  loading,
  error,
  onRetry,
  t,
}: EvaluationCardProps) {
  const getScoreClass = (score: number) => {
    if (score >= 8) return 'score-pill-excellent'
    if (score >= 6) return 'score-pill-good'
    return 'score-pill-average'
  }

  const getOverallScore = (scores: Evaluation['scores']) => {
    const values = Object.values(scores)
    return (values.reduce((left, right) => left + right, 0) / values.length).toFixed(1)
  }

  if (loading) {
    return (
      <div className="intern-card evaluation-card">
        <div className="card-title">📊 Evaluations</div>
        <div className="skeleton-card skeleton-card-xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="intern-card evaluation-card">
        <div className="error-state-modern">
          <div className="error-state-icon">⚠️</div>
          <p className="error-state-text">{error}</p>
          <button className="error-retry-btn" onClick={onRetry}>Retry</button>
        </div>
      </div>
    )
  }

  if (evaluations.length === 0) {
    return (
      <div className="intern-card evaluation-card">
        <div className="card-header">
          <h2 className="card-title"><span className="card-title-icon">📊</span> Evaluations</h2>
        </div>
        <div className="evaluation-pending-state">
          <div className="evaluation-pending-icon">⏳</div>
          <p className="evaluation-pending-title">Evaluation pending review.</p>
          <p className="evaluation-pending-subtitle">Your evaluation is being prepared.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="intern-card evaluation-card">
      <div className="card-header">
        <h2 className="card-title"><span className="card-title-icon">📊</span> {t('dashboard.intern.myEvaluations')}</h2>
      </div>
      <div className="evaluation-list">
        {evaluations.slice(-1).map((evaluation) => (
          <div key={evaluation.id} className="evaluation-item">
            <div className="evaluation-header">
              <h3 className="evaluation-type">{evaluation.type === 'mid_term' ? 'Midterm' : 'Final'}</h3>
              <span className="evaluation-date">{evaluation.date}</span>
            </div>
            {evaluation.releasedAt && (
              <div className="evaluation-release-badge">
                Released on {new Date(evaluation.releasedAt).toLocaleDateString()}
              </div>
            )}
            <div className="evaluation-scores-grid">
              <div className={`score-pill ${getScoreClass(evaluation.scores.technical)}`}>
                <span className="score-pill-value">{evaluation.scores.technical}</span>
                <span className="score-pill-label">Tech</span>
              </div>
              <div className={`score-pill ${getScoreClass(evaluation.scores.autonomy)}`}>
                <span className="score-pill-value">{evaluation.scores.autonomy}</span>
                <span className="score-pill-label">Auto</span>
              </div>
              <div className={`score-pill ${getScoreClass(evaluation.scores.communication)}`}>
                <span className="score-pill-value">{evaluation.scores.communication}</span>
                <span className="score-pill-label">Comm</span>
              </div>
              <div className={`score-pill ${getScoreClass(evaluation.scores.deadlineRespect)}`}>
                <span className="score-pill-value">{evaluation.scores.deadlineRespect}</span>
                <span className="score-pill-label">Time</span>
              </div>
              <div className={`score-pill ${getScoreClass(evaluation.scores.deliverableQuality)}`}>
                <span className="score-pill-value">{evaluation.scores.deliverableQuality}</span>
                <span className="score-pill-label">Quality</span>
              </div>
            </div>
            <div className="overall-score">
              <span className="overall-score-label">Overall:</span>
              <span className="overall-score-value">{getOverallScore(evaluation.scores)}/10</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

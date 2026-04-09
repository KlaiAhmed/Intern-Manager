import { StatusBadge } from './StatusBadge'

interface EvaluationRowBaseProps {
  internName: string
  typeLabel: string
  badgeLabel: string
}

interface EvaluationDueRowProps extends EvaluationRowBaseProps {
  mode: 'due'
  actionLabel: string
  onAction: () => void
  isActionDisabled?: boolean
}

interface EvaluationCompletedRowProps extends EvaluationRowBaseProps {
  mode: 'completed'
  averageScoreLabel: string
  averageScore: number
}

type EvaluationRowProps = EvaluationDueRowProps | EvaluationCompletedRowProps

export function EvaluationRow(props: EvaluationRowProps) {
  return (
    <article className={`supervisor-evaluation-row supervisor-evaluation-row-${props.mode}`}>
      <div className="supervisor-evaluation-row-main">
        <h3 className="supervisor-evaluation-row-name">{props.internName}</h3>
        <p className="supervisor-evaluation-row-type">{props.typeLabel}</p>
      </div>

      <div className="supervisor-evaluation-row-side">
        <StatusBadge
          label={props.badgeLabel}
          tone={props.mode === 'due' ? 'warning' : 'success'}
          size="sm"
        />

        {props.mode === 'due' ? (
          <button
            type="button"
            className="dash-btn dash-btn-primary dash-btn-sm"
            onClick={props.onAction}
            disabled={props.isActionDisabled}
          >
            {props.actionLabel}
          </button>
        ) : (
          <p className="supervisor-evaluation-row-score">
            {props.averageScoreLabel}
            <span>{props.averageScore.toFixed(1)}/10</span>
          </p>
        )}
      </div>
    </article>
  )
}

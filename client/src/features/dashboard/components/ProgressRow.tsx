import { StatusBadge } from './StatusBadge'

type ProgressTone = 'on-track' | 'at-risk' | 'late'

interface ProgressRowProps {
  name: string
  missionTitle: string
  stageType: string
  progress: number
  statusLabel: string
  tone: ProgressTone
  onSelect?: () => void
}

function normalizeProgress(progress: number): number {
  if (Number.isNaN(progress)) {
    return 0
  }

  if (progress < 0) {
    return 0
  }

  if (progress > 100) {
    return 100
  }

  return Math.round(progress)
}

export function ProgressRow({
  name,
  missionTitle,
  stageType,
  progress,
  statusLabel,
  tone,
  onSelect,
}: ProgressRowProps) {
  const progressValue = normalizeProgress(progress)
  const initials = name
    .split(' ')
    .filter((chunk) => chunk.trim().length > 0)
    .slice(0, 2)
    .map((chunk) => chunk.charAt(0).toUpperCase())
    .join('')

  const badgeTone = tone === 'late' ? 'danger' : tone === 'at-risk' ? 'warning' : 'success'

  return (
    <article className={`supervisor-progress-row supervisor-progress-row-${tone}`}>
      <button type="button" className="supervisor-progress-row-button" onClick={onSelect}>
        <span className="supervisor-progress-row-avatar" aria-hidden="true">
          {initials || 'IN'}
        </span>

        <div className="supervisor-progress-row-main">
          <div className="supervisor-progress-row-header">
            <h3 className="supervisor-progress-row-name">{name}</h3>
            <StatusBadge label={statusLabel} tone={badgeTone} size="sm" />
          </div>

          <p className="supervisor-progress-row-meta">
            {missionTitle}
            <span className="supervisor-progress-row-separator">•</span>
            {stageType}
          </p>

          <div className="supervisor-progress-row-progress-wrap">
            <progress
              className={`supervisor-progress-row-meter supervisor-progress-row-meter-${tone}`}
              max={100}
              value={progressValue}
            />
            <span className="supervisor-progress-row-progress-label">{progressValue}%</span>
          </div>
        </div>
      </button>
    </article>
  )
}

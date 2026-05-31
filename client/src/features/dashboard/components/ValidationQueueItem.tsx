import { useMemo, useState } from 'react'
import type { SupervisorValidationQueueItem } from '../types/supervisorDashboard'

interface ValidationQueueItemProps {
  item: SupervisorValidationQueueItem
  isSubmitting: boolean
  openFileLabel: string
  submittedOnLabel: string
  dueOnLabel: string
  versionLabel: string
  acceptLabel: string
  rejectLabel: string
  rejectReasonLabel: string
  rejectReasonLengthLabel: string
  rejectReasonPlaceholder: string
  rejectSubmitLabel: string
  reopenTasksLabel: string
  noTasksLabel: string
  reasonCounterLabel: (count: number) => string
  cancelLabel: string
  onAccept: (item: SupervisorValidationQueueItem) => Promise<void>
  onReject: (item: SupervisorValidationQueueItem, reason: string, taskIdsToReopen: string[]) => Promise<void>
}

function formatDate(value: string | null): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function ValidationQueueItem({
  item,
  isSubmitting,
  openFileLabel,
  submittedOnLabel,
  dueOnLabel,
  versionLabel,
  acceptLabel,
  rejectLabel,
  rejectReasonLabel,
  rejectReasonLengthLabel,
  rejectReasonPlaceholder,
  rejectSubmitLabel,
  reopenTasksLabel,
  noTasksLabel,
  reasonCounterLabel,
  cancelLabel,
  onAccept,
  onReject,
}: ValidationQueueItemProps) {
  const [isRejectComposerOpen, setIsRejectComposerOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [localError, setLocalError] = useState<string | null>(null)

  const submittedDateLabel = useMemo(() => formatDate(item.submittedDate), [item.submittedDate])
  const dueDateLabel = useMemo(() => formatDate(item.dueDate), [item.dueDate])

  const handleRejectSubmit = async () => {
    const reason = rejectReason.trim()
    if (reason.length < 10 || reason.length > 1000) {
      setLocalError(rejectReasonLengthLabel)
      return
    }

    if (item.tasks.length > 0 && selectedTaskIds.length === 0) {
      setLocalError(reopenTasksLabel)
      return
    }

    setLocalError(null)
    await onReject(item, reason, selectedTaskIds)
    setRejectReason('')
    setSelectedTaskIds([])
    setIsRejectComposerOpen(false)
  }

  return (
    <article className="supervisor-validation-item">
      <div className="supervisor-validation-item-main">
        <div className="supervisor-validation-item-primary">
          <h3 className="supervisor-validation-item-title">{item.title}</h3>
          <p className="supervisor-validation-item-meta">{item.internName}</p>
        </div>

        <dl className="supervisor-validation-item-details">
          <div>
            <dt>{versionLabel}</dt>
            <dd>v{item.version}</dd>
          </div>
          <div>
            <dt>{submittedOnLabel}</dt>
            <dd>{submittedDateLabel}</dd>
          </div>
          <div>
            <dt>{dueOnLabel}</dt>
            <dd>{dueDateLabel}</dd>
          </div>
        </dl>
      </div>

      <div className="supervisor-validation-item-actions">
        <a
          className="dash-btn dash-btn-secondary dash-btn-sm"
          href={item.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {openFileLabel}
        </a>

        <button
          type="button"
          className="dash-btn dash-btn-primary dash-btn-sm"
          disabled={isSubmitting}
          onClick={() => void onAccept(item)}
        >
          {acceptLabel}
        </button>

        <button
          type="button"
          className="dash-btn dash-btn-secondary dash-btn-sm"
          disabled={isSubmitting}
          onClick={() => setIsRejectComposerOpen((previous) => !previous)}
        >
          {rejectLabel}
        </button>
      </div>

      {isRejectComposerOpen && (
        <div className="supervisor-validation-reject-composer">
          <fieldset className="supervisor-validation-task-list">
            <legend>{reopenTasksLabel}</legend>
            {item.tasks.length === 0 ? (
              <p>{noTasksLabel}</p>
            ) : (
              item.tasks.map((task) => (
                <label key={task.id} className="supervisor-validation-task-option">
                  <input
                    type="checkbox"
                    checked={selectedTaskIds.includes(task.id)}
                    disabled={isSubmitting}
                    onChange={(event) => {
                      setSelectedTaskIds((previous) =>
                        event.target.checked
                          ? [...previous, task.id]
                          : previous.filter((taskId) => taskId !== task.id)
                      )
                    }}
                  />
                  <span>{task.title}</span>
                </label>
              ))
            )}
          </fieldset>

          <label htmlFor={`reject-reason-${item.id}`}>{rejectReasonLabel}</label>
          <textarea
            id={`reject-reason-${item.id}`}
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value.slice(0, 1000))}
            rows={3}
            placeholder={rejectReasonPlaceholder}
            minLength={10}
            maxLength={1000}
            disabled={isSubmitting}
          />
          <p className="supervisor-validation-reject-counter">{reasonCounterLabel(rejectReason.trim().length)}</p>
          {localError && <p className="supervisor-validation-reject-error">{localError}</p>}
          <div className="supervisor-validation-reject-actions">
            <button
              type="button"
              className="dash-btn dash-btn-secondary dash-btn-sm"
              disabled={isSubmitting}
              onClick={() => {
                setIsRejectComposerOpen(false)
                setRejectReason('')
                setSelectedTaskIds([])
                setLocalError(null)
              }}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className="dash-btn dash-btn-primary dash-btn-sm"
              disabled={isSubmitting}
              onClick={() => void handleRejectSubmit()}
            >
              {rejectSubmitLabel}
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

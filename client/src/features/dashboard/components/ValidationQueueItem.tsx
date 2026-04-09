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
  rejectReasonPlaceholder: string
  rejectSubmitLabel: string
  cancelLabel: string
  onAccept: (item: SupervisorValidationQueueItem) => Promise<void>
  onReject: (item: SupervisorValidationQueueItem, reason: string) => Promise<void>
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
  rejectReasonPlaceholder,
  rejectSubmitLabel,
  cancelLabel,
  onAccept,
  onReject,
}: ValidationQueueItemProps) {
  const [isRejectComposerOpen, setIsRejectComposerOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const submittedDateLabel = useMemo(() => formatDate(item.submittedDate), [item.submittedDate])
  const dueDateLabel = useMemo(() => formatDate(item.dueDate), [item.dueDate])

  const handleRejectSubmit = async () => {
    const reason = rejectReason.trim()
    if (!reason) {
      setLocalError(rejectReasonLabel)
      return
    }

    setLocalError(null)
    await onReject(item, reason)
    setRejectReason('')
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
          <label htmlFor={`reject-reason-${item.id}`}>{rejectReasonLabel}</label>
          <textarea
            id={`reject-reason-${item.id}`}
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            rows={3}
            placeholder={rejectReasonPlaceholder}
            disabled={isSubmitting}
          />
          {localError && <p className="supervisor-validation-reject-error">{localError}</p>}
          <div className="supervisor-validation-reject-actions">
            <button
              type="button"
              className="dash-btn dash-btn-secondary dash-btn-sm"
              disabled={isSubmitting}
              onClick={() => {
                setIsRejectComposerOpen(false)
                setRejectReason('')
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

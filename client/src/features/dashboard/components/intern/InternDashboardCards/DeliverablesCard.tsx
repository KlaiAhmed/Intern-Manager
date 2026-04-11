import { useMemo } from 'react'
import type { Deliverable, TranslateFn } from '../../../types/internDashboard'
import { Icons } from './Icons'

interface DeliverablesCardProps {
  deliverables: Deliverable[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onUploadClick: (id: string) => void
  onViewComment: (deliverableItem: Deliverable) => void
  isReadOnly?: boolean
  t: TranslateFn
}

export function DeliverablesCard({
  deliverables,
  loading,
  error,
  onRetry,
  onUploadClick,
  onViewComment,
  isReadOnly = false,
  t,
}: DeliverablesCardProps) {
  const { displayDeliverables, acceptedCount, totalCount } = useMemo(() => {
    let accepted = 0
    for (const d of deliverables) {
      if (d.status === 'accepted') accepted++
    }
    return { displayDeliverables: deliverables.slice(0, 3), acceptedCount: accepted, totalCount: deliverables.length }
  }, [deliverables])

  const getStatusClass = (status: Deliverable['status']) => {
    switch (status) {
      case 'submitted': return 'deliverable-status-submitted'
      case 'accepted': return 'deliverable-status-accepted'
      case 'rejected': return 'deliverable-status-rejected'
      default: return 'deliverable-status-pending'
    }
  }

  const getStatusLabel = (status: Deliverable['status']) => {
    switch (status) {
      case 'submitted': return t('dashboard.intern.submitted')
      case 'accepted': return t('dashboard.intern.accepted')
      case 'rejected': return t('dashboard.intern.rejected')
      default: return t('dashboard.intern.notSubmitted')
    }
  }

  const getProgressClass = (status: Deliverable['status']) => {
    switch (status) {
      case 'submitted': return 'deliverable-progress-fill-submitted'
      case 'accepted': return 'deliverable-progress-fill-accepted'
      case 'rejected': return 'deliverable-progress-fill-rejected'
      default: return 'deliverable-progress-fill-pending'
    }
  }

  if (loading) {
    return (
      <div className="intern-card deliverables-card">
        <div className="card-title">📁 {t('dashboard.intern.card.deliverables.title')}</div>
        <div className="deliverable-list">
          {[1, 2].map((index) => <div key={index} className="skeleton-card skeleton-card-lg" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="intern-card deliverables-card">
        <div className="error-state-modern">
          <div className="error-state-icon">⚠️</div>
          <p className="error-state-text">{error}</p>
          <button className="error-retry-btn" onClick={onRetry}>{t('dashboard.intern.card.retry')}</button>
        </div>
      </div>
    )
  }

  if (deliverables.length === 0) {
    return (
      <div className="intern-card deliverables-card">
        <div className="card-header">
          <h2 className="card-title"><span className="card-title-icon">📁</span> {t('dashboard.intern.card.deliverables.title')}</h2>
        </div>
        <div className="empty-state-modern">
          <div className="empty-state-icon">📂</div>
          <p className="empty-state-text">{t('dashboard.intern.card.deliverables.empty')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="intern-card deliverables-card">
      <div className="card-header">
        <h2 className="card-title"><span className="card-title-icon">📁</span> {t('dashboard.intern.card.deliverables.title')}</h2>
        <span className="card-action">{acceptedCount}/{totalCount}</span>
      </div>
      {isReadOnly && <p className="card-readonly-hint">Deliverable submissions are currently read-only.</p>}
      <div className="deliverable-list">
        {displayDeliverables.map((deliverableItem) => (
          <div key={deliverableItem.id} className="deliverable-item">
            <div className="deliverable-header-row">
              <div className="deliverable-title-row">
                <div className="deliverable-icon">📄</div>
                <span className="deliverable-name">{deliverableItem.title}</span>
              </div>
              <span className={`deliverable-status ${getStatusClass(deliverableItem.status)}`}>
                {getStatusLabel(deliverableItem.status)}
                {deliverableItem.status === 'submitted' && ` v${deliverableItem.version}`}
              </span>
            </div>
            <div className="deliverable-progress-mini">
              <div className="deliverable-progress-track">
                <div className={`deliverable-progress-fill ${getProgressClass(deliverableItem.status)}`} style={{ width: `${deliverableItem.progress}%` }} />
              </div>
              <span className="deliverable-progress-value">{deliverableItem.progress}%</span>
            </div>
            <div className="deliverable-actions-row">
              <button
                className="deliverable-btn deliverable-btn-primary"
                onClick={() => !isReadOnly && onUploadClick(deliverableItem.id)}
                disabled={isReadOnly}
              >
                <Icons.upload /> {t('dashboard.intern.card.deliverables.upload')}
              </button>
              {deliverableItem.status === 'rejected' && deliverableItem.supervisorComment && (
                <button className="deliverable-btn" onClick={() => onViewComment(deliverableItem)}>
                  <Icons.comment /> {t('dashboard.intern.card.deliverables.view')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

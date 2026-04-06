import type { Deliverable } from '../../../types/internDashboard'
import { Icons } from './Icons'

interface DeliverablesCardProps {
  deliverables: Deliverable[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onUploadClick: (id: string) => void
  onViewComment: (deliverableItem: Deliverable) => void
}

export function DeliverablesCard({
  deliverables,
  loading,
  error,
  onRetry,
  onUploadClick,
  onViewComment,
}: DeliverablesCardProps) {
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
      case 'submitted': return 'Submitted'
      case 'accepted': return 'Accepted'
      case 'rejected': return 'Rejected'
      default: return 'Pending'
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
        <div className="card-title">📁 Deliverables</div>
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
          <button className="error-retry-btn" onClick={onRetry}>Retry</button>
        </div>
      </div>
    )
  }

  if (deliverables.length === 0) {
    return (
      <div className="intern-card deliverables-card">
        <div className="card-header">
          <h2 className="card-title"><span className="card-title-icon">📁</span> Deliverables</h2>
        </div>
        <div className="empty-state-modern">
          <div className="empty-state-icon">📂</div>
          <p className="empty-state-text">No deliverables</p>
        </div>
      </div>
    )
  }

  return (
    <div className="intern-card deliverables-card">
      <div className="card-header">
        <h2 className="card-title"><span className="card-title-icon">📁</span> Deliverables</h2>
        <span className="card-action">{deliverables.filter((deliverableItem) => deliverableItem.status === 'accepted').length}/{deliverables.length}</span>
      </div>
      <div className="deliverable-list">
        {deliverables.slice(0, 3).map((deliverableItem) => (
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
              <button className="deliverable-btn deliverable-btn-primary" onClick={() => onUploadClick(deliverableItem.id)}>
                <Icons.upload /> Upload
              </button>
              {deliverableItem.status === 'rejected' && deliverableItem.supervisorComment && (
                <button className="deliverable-btn" onClick={() => onViewComment(deliverableItem)}>
                  <Icons.comment /> View
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

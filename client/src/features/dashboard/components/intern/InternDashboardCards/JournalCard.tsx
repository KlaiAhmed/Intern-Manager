import type { JournalEntry } from '../../../types/internDashboard'

interface JournalCardProps {
  entries: JournalEntry[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onAddClick: () => void
}

export function JournalCard({
  entries,
  loading,
  error,
  onRetry,
  onAddClick,
}: JournalCardProps) {
  if (loading) {
    return (
      <div className="intern-card journal-card">
        <div className="card-title">📝 Journal</div>
        <div className="journal-entries-list">
          {[1, 2].map((index) => <div key={index} className="skeleton-card skeleton-card-md" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="intern-card journal-card">
        <div className="error-state-modern">
          <div className="error-state-icon">⚠️</div>
          <p className="error-state-text">{error}</p>
          <button className="error-retry-btn" onClick={onRetry}>Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="intern-card journal-card">
      <div className="card-header">
        <h2 className="card-title"><span className="card-title-icon">📝</span> Journal</h2>
        <span className="card-action">{entries.length} entries</span>
      </div>
      {entries.length === 0 ? (
        <div className="empty-state-modern">
          <div className="empty-state-icon">📝</div>
          <p className="empty-state-text">No journal entries</p>
          <button className="deliverable-btn deliverable-btn-primary journal-add-entry-btn" onClick={onAddClick}>
            + Add Entry
          </button>
        </div>
      ) : (
        <div className="journal-entries-list">
          {entries.slice(0, 2).map((entry) => (
            <div key={entry.id} className="journal-entry-modern">
              <p className="journal-entry-content">{entry.content}</p>
              <span className="journal-entry-date">{entry.createdAt}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

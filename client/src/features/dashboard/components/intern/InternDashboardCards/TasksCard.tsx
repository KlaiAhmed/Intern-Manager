import type { Task, TranslateFn } from '../../../types/internDashboard'

interface TasksCardProps {
  tasks: Task[]
  loading: boolean
  error: string | null
  onRetry: () => void
  onComplete: (id: string) => void
  t: TranslateFn
}

export function TasksCard({
  tasks,
  loading,
  error,
  onRetry,
  onComplete,
  t,
}: TasksCardProps) {
  const incompleteTasks = tasks.filter((taskItem) => !taskItem.completed).slice(0, 4)

  if (loading) {
    return (
      <div className="intern-card tasks-card">
        <div className="card-title">{t('dashboard.intern.card.tasks.title')}</div>
        <div className="task-list-modern">
          {[1, 2, 3].map((index) => <div key={index} className="skeleton-card skeleton-card-sm" />)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="intern-card tasks-card">
        <div className="error-state-modern">
          <div className="error-state-icon">⚠️</div>
          <p className="error-state-text">{error}</p>
          <button className="error-retry-btn" onClick={onRetry}>{t('dashboard.intern.card.retry')}</button>
        </div>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="intern-card tasks-card">
        <div className="card-header">
          <h2 className="card-title"><span className="card-title-icon">📋</span> {t('dashboard.intern.card.tasks.title')}</h2>
        </div>
        <div className="empty-state-modern">
          <div className="empty-state-icon">✅</div>
          <p className="empty-state-text">{t('dashboard.intern.card.tasks.empty')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="intern-card tasks-card">
      <div className="card-header">
        <h2 className="card-title"><span className="card-title-icon">📋</span> {t('dashboard.intern.card.tasks.title')}</h2>
        <span className="card-action">{tasks.filter((taskItem) => taskItem.completed).length}/{tasks.length}</span>
      </div>
      <div className="task-list-modern">
        {incompleteTasks.map((taskItem) => (
          <div key={taskItem.id} className={`task-item-modern ${taskItem.completed ? 'completed' : ''}`}>
            <input
              type="checkbox"
              checked={taskItem.completed}
              onChange={() => !taskItem.completed && onComplete(taskItem.id)}
              disabled={taskItem.completed}
              className="task-checkbox-modern"
            />
            <div className="task-content-modern">
              <p className="task-title-modern">{taskItem.title}</p>
              <p className="task-due-modern">{t('dashboard.intern.card.tasks.due')} {taskItem.dueDate}</p>
            </div>
            <div className={`task-priority task-priority-${taskItem.priority || 'low'}`} />
          </div>
        ))}
      </div>
    </div>
  )
}

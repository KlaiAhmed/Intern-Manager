import { useEffect, useState } from 'react'
import type { Deliverable, Internship, Task, TranslateFn } from '../../../types/internDashboard'

interface QuickStatsCardProps {
  tasks: Task[]
  deliverables: Deliverable[]
  internship: Internship | null
  meetingsCount: number
  loading: boolean
  t: TranslateFn
}

export function QuickStatsCard({
  tasks,
  deliverables,
  internship,
  meetingsCount,
  loading,
  t,
}: QuickStatsCardProps) {
  const [currentTimeMs, setCurrentTimeMs] = useState<number | null>(null)

  useEffect(() => {
    const updateCurrentTime = () => {
      setCurrentTimeMs(Date.now())
    }

    updateCurrentTime()
    const intervalId = window.setInterval(updateCurrentTime, 60_000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [])

  const completedTasks = tasks.filter((taskItem) => taskItem.completed).length
  const submittedDeliverables = deliverables.filter((deliverableItem) => deliverableItem.status !== 'not_submitted').length
  const daysLeft = internship && currentTimeMs !== null
    ? Math.ceil((new Date(internship.endDate).getTime() - currentTimeMs) / (1000 * 60 * 60 * 24))
    : 0

  if (loading) {
    return (
      <div className="intern-card stats-card">
        <div className="stats-card-title">{t('dashboard.intern.card.overview.title')}</div>
        <div className="stats-grid">
          {[1, 2, 3, 4].map((index) => (
            <div key={index} className="skeleton-card skeleton-card-stats" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="intern-card stats-card">
      <h2 className="stats-card-title">{t('dashboard.intern.card.overview.title')}</h2>
      <div className="stats-grid">
        <div className="stat-bubble">
          <div className="stat-bubble-icon stat-bubble-icon-tasks">📋</div>
          <div className="stat-bubble-value">{completedTasks}/{tasks.length}</div>
          <div className="stat-bubble-label">{t('dashboard.intern.card.overview.tasksDone')}</div>
        </div>
        <div className="stat-bubble">
          <div className="stat-bubble-icon stat-bubble-icon-deliverables">📁</div>
          <div className="stat-bubble-value">{submittedDeliverables}/{deliverables.length}</div>
          <div className="stat-bubble-label">{t('dashboard.intern.card.overview.files')}</div>
        </div>
        <div className="stat-bubble">
          <div className="stat-bubble-icon stat-bubble-icon-days">📅</div>
          <div className="stat-bubble-value">{Math.max(0, daysLeft)}</div>
          <div className="stat-bubble-label">{t('dashboard.intern.card.overview.daysLeft')}</div>
        </div>
        <div className="stat-bubble">
          <div className="stat-bubble-icon stat-bubble-icon-meetings">👥</div>
          <div className="stat-bubble-value">{meetingsCount}</div>
          <div className="stat-bubble-label">{t('dashboard.intern.card.overview.meetings')}</div>
        </div>
      </div>
    </div>
  )
}

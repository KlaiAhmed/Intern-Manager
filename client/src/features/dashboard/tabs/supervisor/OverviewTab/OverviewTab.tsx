import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { format } from 'date-fns'

import { useI18n } from '../../../../../locales/I18nContext'
import { Avatar } from '../../../components/Avatar/Avatar'
import { DashboardButton } from '../../../components/DashboardButton'
import { ErrorState } from '../../../components/ErrorState'
import { Calendar } from '../../../components/IconComponents'
import { Panel } from '../../../components/Panel'
import { Skeleton } from '../../../components/Skeleton'
import { StatusBadge } from '../../../components/StatusBadge'
import { Toast } from '../../../components/Toast/Toast'
import { useToast } from '../../../components/Toast/useToast'
import type {
  DeliverableStatus,
  InternWithProgress,
  MissionHistoryEntry,
  MissionStatus,
  StatusTone,
  SupervisorDeliverable,
} from '../../../types/supervisorDashboard'
import { useOverviewData } from './hooks/useOverviewData'

interface OverviewTabProps {
  missionId: string
  onTabChange: (tabId: string) => void
}

type KpiTone = 'neutral' | 'success' | 'warning'

const DESCRIPTION_LIMIT = 150
const ACTIVITY_LIMIT = 10

const missionStatusToneMap: Record<MissionStatus, StatusTone> = {
  active: 'success',
  paused: 'warning',
  completed: 'neutral',
  draft: 'neutral',
  cancelled: 'danger',
  archived: 'neutral',
}

const deliverableStatusColorMap: Record<DeliverableStatus, string> = {
  approved: 'var(--dash-success)',
  awaiting_review: 'var(--dash-warning)',
  changes_requested: 'var(--dash-error)',
  draft: 'var(--dash-border)',
  in_progress: 'var(--dash-accent)',
  cancelled: 'var(--dash-text-secondary)',
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0
  }
  if (value >= 100) {
    return 100
  }
  return Math.round(value)
}

function normalizeStatus(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function formatDate(value: string | null | undefined, fallback: string): string {
  if (!value) {
    return fallback
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return format(parsedDate, 'PP')
}

function formatRelativeTime(value: string, locale: string, fallback: string): string {
  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return fallback
  }

  const diffInSeconds = Math.round((parsedDate.getTime() - Date.now()) / 1000)
  const absSeconds = Math.abs(diffInSeconds)
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

  if (absSeconds < 60) {
    return formatter.format(diffInSeconds, 'second')
  }

  const diffInMinutes = Math.round(diffInSeconds / 60)
  if (Math.abs(diffInMinutes) < 60) {
    return formatter.format(diffInMinutes, 'minute')
  }

  const diffInHours = Math.round(diffInMinutes / 60)
  if (Math.abs(diffInHours) < 24) {
    return formatter.format(diffInHours, 'hour')
  }

  const diffInDays = Math.round(diffInHours / 24)
  if (Math.abs(diffInDays) < 30) {
    return formatter.format(diffInDays, 'day')
  }

  const diffInMonths = Math.round(diffInDays / 30)
  if (Math.abs(diffInMonths) < 12) {
    return formatter.format(diffInMonths, 'month')
  }

  return formatter.format(Math.round(diffInMonths / 12), 'year')
}

function getMissionStatusLabel(status: MissionStatus, t: (key: string) => string): string {
  return t(`dashboard.supervisor.status.${status}`)
}

function getActivityAction(entry: MissionHistoryEntry, t: (key: string, values?: Record<string, string | number>) => string): string {
  if (entry.action) {
    return entry.action
  }

  if (entry.newValue && entry.oldValue) {
    return t('dashboard.supervisor.activity.changedFieldFromTo', {
      field: entry.field,
      oldValue: entry.oldValue,
      newValue: entry.newValue,
    })
  }

  if (entry.newValue) {
    return t('dashboard.supervisor.activity.changedFieldTo', {
      field: entry.field,
      newValue: entry.newValue,
    })
  }

  return t('dashboard.supervisor.activity.changedField', { field: entry.field })
}

function OverviewKpiCard({
  label,
  value,
  tone,
  onClick,
  ariaLabel,
  visual,
}: {
  label: string
  value: string | number
  tone: KpiTone
  onClick?: () => void
  ariaLabel?: string
  visual?: ReactNode
}) {
  const className = `overview-kpi-card overview-kpi-card-${tone} ${onClick ? 'overview-kpi-card-clickable' : ''}`.trim()
  const body = (
    <>
      <div className="overview-kpi-copy">
        <h3 className="overview-kpi-label">{label}</h3>
        <p className="overview-kpi-value">{value}</p>
      </div>
      {visual && <div className="overview-kpi-visual">{visual}</div>}
    </>
  )

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} aria-label={ariaLabel ?? label}>
        {body}
      </button>
    )
  }

  return <article className={className}>{body}</article>
}

function LoadingState({ toasts, onDismiss }: { toasts: ReturnType<typeof useToast>['toasts']; onDismiss: (id: string) => void }) {
  return (
    <>
      <div className="overview-tab">
        <div className="dash-stats-row">
          <Skeleton height="132px" />
          <Skeleton height="132px" />
          <Skeleton height="132px" />
          <Skeleton height="132px" />
        </div>
        <div className="overview-split-grid">
          <div className="overview-stack">
            <Skeleton height="286px" />
            <Skeleton height="56px" />
          </div>
          <div className="overview-stack">
            <Skeleton height="220px" />
            <Skeleton height="220px" />
          </div>
        </div>
        <Skeleton height="160px" />
      </div>
      <Toast toasts={toasts} onDismiss={onDismiss} />
    </>
  )
}

function EmptyState({ text }: { text: string }) {
  return <div className="dash-empty overview-empty">{text}</div>
}

function AvatarStack({
  interns,
  moreLabel,
}: {
  interns: InternWithProgress[]
  moreLabel: (count: number) => string
}) {
  const visibleInterns = interns.slice(0, 3)
  const hiddenCount = Math.max(0, interns.length - visibleInterns.length)

  return (
    <div className="overview-avatar-stack" aria-hidden="true">
      <div className="overview-avatar-stack-items">
        {visibleInterns.map((intern) => (
          <Avatar key={intern.id} name={intern.fullName} size="sm" className="overview-avatar-stack-item" />
        ))}
      </div>
      {hiddenCount > 0 && <span className="overview-avatar-more">{moreLabel(hiddenCount)}</span>}
    </div>
  )
}

function MissionTimeline({
  deliverables,
  emptyLabel,
}: {
  deliverables: SupervisorDeliverable[]
  emptyLabel: string
}) {
  if (deliverables.length === 0) {
    return <EmptyState text={emptyLabel} />
  }

  const gridStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${deliverables.length}, minmax(0, 1fr))`,
  }

  return (
    <div className="overview-timeline-strip" style={gridStyle}>
      {deliverables.map((deliverable) => (
        <div
          key={deliverable.id}
          className="overview-timeline-item"
          style={{ backgroundColor: deliverableStatusColorMap[deliverable.status] }}
          title={deliverable.title}
        >
          <span>{deliverable.title}</span>
        </div>
      ))}
    </div>
  )
}

export function OverviewTab({ missionId, onTabChange }: OverviewTabProps) {
  const { t, locale } = useI18n()
  const { toasts, dismissToast } = useToast()
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const {
    pendingReviewCount,
    upcomingMeetingCount,
    interns,
    mission,
    deliverables,
    activityFeed,
    isLoading,
    error,
    refresh,
  } = useOverviewData(missionId)

  const taskTotals = useMemo(
    () =>
      interns.reduce(
        (totals, intern) => ({
          taskCount: totals.taskCount + intern.taskCount,
          taskDoneCount: totals.taskDoneCount + intern.taskDoneCount,
        }),
        { taskCount: 0, taskDoneCount: 0 },
      ),
    [interns],
  )

  if (isLoading) {
    return <LoadingState toasts={toasts} onDismiss={dismissToast} />
  }

  if (error) {
    return (
      <>
        <ErrorState message={error} onRetry={() => { void refresh() }} />
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </>
    )
  }

  const taskProgressPercent =
    taskTotals.taskCount > 0 ? clampPercent((taskTotals.taskDoneCount / taskTotals.taskCount) * 100) : 0
  const description = mission?.description ?? ''
  const hasLongDescription = description.length > DESCRIPTION_LIMIT
  const visibleDescription =
    hasLongDescription && !isDescriptionExpanded ? `${description.slice(0, DESCRIPTION_LIMIT)}...` : description
  const missionStatus = mission?.status ?? 'draft'
  const fallbackDate = t('dashboard.noData')

  return (
    <>
      <div className="overview-tab">
        <div className="dash-stats-row">
          <OverviewKpiCard
            label={t('dashboard.supervisor.overview.tasksProgress')}
            value={`${taskTotals.taskDoneCount}/${taskTotals.taskCount}`}
            tone={taskProgressPercent === 100 && taskTotals.taskCount > 0 ? 'success' : 'neutral'}
            onClick={() => onTabChange('tasks')}
            ariaLabel={t('dashboard.supervisor.overview.openTasks')}
            visual={
              <span
                className="overview-progress-circle"
                style={{
                  background: `conic-gradient(var(--dash-accent) ${taskProgressPercent}%, var(--dash-bg-secondary) 0)`,
                }}
                aria-hidden="true"
              >
                <span>{taskProgressPercent}%</span>
              </span>
            }
          />
          <OverviewKpiCard
            label={t('dashboard.supervisor.overview.pendingReviews')}
            value={pendingReviewCount.toLocaleString(locale)}
            tone={pendingReviewCount > 0 ? 'warning' : 'neutral'}
            onClick={() => onTabChange('deliverables')}
            ariaLabel={t('dashboard.supervisor.overview.openDeliverables')}
          />
          <OverviewKpiCard
            label={t('dashboard.supervisor.overview.meetingsThisWeek')}
            value={upcomingMeetingCount.toLocaleString(locale)}
            tone="neutral"
            onClick={() => onTabChange('meetings')}
            ariaLabel={t('dashboard.supervisor.overview.openMeetings')}
          />
          <OverviewKpiCard
            label={t('dashboard.supervisor.overview.activeInterns')}
            value={interns.length.toLocaleString(locale)}
            tone="neutral"
            visual={<AvatarStack interns={interns} moreLabel={(count) => t('dashboard.supervisor.overview.moreInterns', { count })} />}
          />
        </div>

        <div className="overview-split-grid">
          <div className="overview-stack">
            <Panel
              title={mission?.title || t('dashboard.supervisor.overview.missionSummary')}
              actions={
                <StatusBadge
                  label={getMissionStatusLabel(missionStatus, t)}
                  tone={missionStatusToneMap[missionStatus]}
                  size="sm"
                />
              }
            >
              {mission ? (
                <div className="overview-mission-summary">
                  <div>
                    <p className="overview-mission-description">
                      {visibleDescription || t('dashboard.noData')}
                    </p>
                    {hasLongDescription && (
                      <DashboardButton
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsDescriptionExpanded((current) => !current)}
                      >
                        {isDescriptionExpanded
                          ? t('dashboard.supervisor.overview.showLess')
                          : t('dashboard.supervisor.overview.showMore')}
                      </DashboardButton>
                    )}
                  </div>

                  <div
                    className="dash-progress overview-main-progress"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={clampPercent(mission.rawProgress)}
                    aria-label={t('dashboard.supervisor.overview.missionProgress')}
                  >
                    <div className="dash-progress-fill" style={{ width: `${clampPercent(mission.rawProgress)}%` }} />
                  </div>

                  <div className="overview-date-list">
                    <div className="overview-date-row">
                      <Calendar size={18} />
                      <span>{t('dashboard.supervisor.overview.startDate')}</span>
                      <strong>{formatDate(mission.startDate, fallbackDate)}</strong>
                    </div>
                    <div className="overview-date-row">
                      <Calendar size={18} />
                      <span>{t('dashboard.supervisor.overview.endDate')}</span>
                      <strong>{formatDate(mission.endDate, fallbackDate)}</strong>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState text={t('dashboard.supervisor.overview.noMission')} />
              )}
            </Panel>

            <MissionTimeline deliverables={deliverables} emptyLabel={t('dashboard.supervisor.empty.noDeliverables')} />
          </div>

          <div className="overview-stack">
            <Panel title={t('dashboard.supervisor.overview.internRoster')}>
              {interns.length === 0 ? (
                <EmptyState text={t('dashboard.supervisor.empty.noInterns')} />
              ) : (
                <ul className="overview-roster-list">
                  {interns.map((intern) => {
                    const isActive = normalizeStatus(intern.status) === 'active'
                    return (
                      <li key={intern.id} className="overview-roster-item">
                        <Avatar name={intern.fullName} size="sm" />
                        <div className="overview-roster-main">
                          <span className="overview-roster-name">{intern.fullName}</span>
                          <div
                            className="dash-progress"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={clampPercent(intern.progressPercent)}
                            aria-label={t('dashboard.supervisor.overview.internProgress', { name: intern.fullName })}
                          >
                            <div className="dash-progress-fill" style={{ width: `${clampPercent(intern.progressPercent)}%` }} />
                          </div>
                        </div>
                        <StatusBadge
                          label={
                            isActive
                              ? t('dashboard.supervisor.status.active')
                              : t('dashboard.supervisor.status.inactive')
                          }
                          tone={isActive ? 'success' : 'neutral'}
                          size="sm"
                        />
                      </li>
                    )
                  })}
                </ul>
              )}
            </Panel>

            <Panel title={t('dashboard.supervisor.overview.activityFeed')}>
              {activityFeed.length === 0 ? (
                <EmptyState text={t('dashboard.supervisor.empty.noActivity')} />
              ) : (
                <ul className="overview-activity-list">
                  {activityFeed.slice(0, ACTIVITY_LIMIT).map((entry) => (
                    <li key={entry.id} className="overview-activity-item">
                      <time dateTime={entry.changedAt}>
                        {formatRelativeTime(entry.changedAt, locale, fallbackDate)}
                      </time>
                      <span>{getActivityAction(entry, t)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>

        <Panel title={t('dashboard.supervisor.overview.notesTitle')} className="overview-notes-panel">
          <EmptyState text={t('dashboard.supervisor.empty.notesComingSoon')} />
        </Panel>
      </div>
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}

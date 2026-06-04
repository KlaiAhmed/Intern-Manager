import { format } from 'date-fns'
import type { CSSProperties } from 'react'

import { Avatar } from '@/features/dashboard/components/Avatar/Avatar'
import { DashboardButton } from '@/features/dashboard/components/DashboardButton'
import { Download, Eye } from '@/features/dashboard/components/IconComponents'
import { StatusBadge } from '@/features/dashboard/components/StatusBadge'
import { getDeliverableStatusTone } from '@/features/dashboard/shared/utils/supervisorUtils'
import type {
  DeliverableStatus,
  DeliverableVersion,
  SupervisorDeliverable,
  SupervisorIntern,
} from '@/features/dashboard/types/supervisorDashboard'
import { useI18n } from '@/locales/I18nContext'

interface InternDeliverableCardProps {
  deliverable: SupervisorDeliverable
  intern: SupervisorIntern | undefined
  onApprove: () => void
  onReject: () => void
}

type DeliverableVersionWithCurrentFlag = DeliverableVersion & { isCurrentVersion?: boolean }

const statusBorderColor: Record<DeliverableStatus, string> = {
  draft: 'var(--dash-border-hover)',
  in_progress: 'var(--dash-accent)',
  awaiting_review: 'var(--dash-warning)',
  approved: 'var(--dash-success)',
  changes_requested: 'var(--dash-error)',
  cancelled: 'var(--dash-text-muted)',
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return format(date, 'MMM d, yyyy')
}

function getInternName(deliverable: SupervisorDeliverable, intern: SupervisorIntern | undefined): string {
  return intern?.fullName || deliverable.internName || 'Unassigned intern'
}

export function getStatusLabel(status: DeliverableStatus, t: (key: string) => string): string {
  return t(`dashboard.supervisor.deliverables.status.${status}`)
}

export function getCurrentVersion(deliverable: SupervisorDeliverable): DeliverableVersionWithCurrentFlag | undefined {
  const versions = deliverable.versions as DeliverableVersionWithCurrentFlag[] | undefined
  const currentVersion = versions?.find((version) => version.isCurrentVersion === true)

  if (currentVersion) {
    return currentVersion
  }

  return versions?.slice().sort((a, b) => b.versionNumber - a.versionNumber)[0]
}

export function InternDeliverableCard({
  deliverable,
  intern,
  onApprove,
  onReject,
}: InternDeliverableCardProps) {
  const { t } = useI18n()
  const internName = getInternName(deliverable, intern)
  const currentVersion = getCurrentVersion(deliverable)
  const submittedDate = formatDate(deliverable.submittedDate ?? currentVersion?.submittedAt)
  const statusLabel = getStatusLabel(deliverable.status, t)
  const cardStyle: CSSProperties = {
    borderLeftColor: statusBorderColor[deliverable.status],
  }

  return (
    <article className="supervisor-deliverable-card" style={cardStyle}>
      <div className="supervisor-deliverable-card__main">
        <Avatar name={internName} size="sm" />
        <div className="supervisor-deliverable-card__content">
          <div className="supervisor-deliverable-card__headline">
            <h3>{deliverable.title}</h3>
            <StatusBadge label={statusLabel} tone={getDeliverableStatusTone(deliverable.status)} size="sm" />
          </div>
          <div className="supervisor-deliverable-card__meta">
            <span>{internName}</span>
            {submittedDate && <span>{t('dashboard.supervisor.deliverables.submittedOn', { date: submittedDate })}</span>}
            {currentVersion?.fileUrl && (
              <a href={currentVersion.fileUrl} target="_blank" rel="noopener noreferrer">
                <Download />
                <span>{t('dashboard.supervisor.deliverables.downloadFile')}</span>
              </a>
            )}
            {!currentVersion?.fileUrl && currentVersion?.gitHubUrl && (
              <a href={currentVersion.gitHubUrl} target="_blank" rel="noopener noreferrer">
                <Eye />
                <span>{t('dashboard.supervisor.deliverables.viewGithub')}</span>
              </a>
            )}
            {!currentVersion?.fileUrl &&
              !currentVersion?.gitHubUrl &&
              (deliverable.status === 'draft' || deliverable.status === 'in_progress') && (
                <span className="supervisor-deliverable-card__muted">
                  {t('dashboard.supervisor.deliverables.awaitingSubmission')}
                </span>
              )}
          </div>
        </div>
      </div>

      {deliverable.status === 'awaiting_review' && (
        <div className="supervisor-deliverable-card__actions">
          <DashboardButton type="button" variant="primary" size="sm" onClick={onApprove}>
            {t('dashboard.supervisor.deliverables.approve')}
          </DashboardButton>
          <DashboardButton type="button" variant="secondary" size="sm" onClick={onReject}>
            {t('dashboard.supervisor.deliverables.requestChanges')}
          </DashboardButton>
        </div>
      )}

      {deliverable.status === 'changes_requested' && (
        <p className="supervisor-deliverable-card__revision">
          {t('dashboard.supervisor.deliverables.revisionRequested')}
        </p>
      )}
    </article>
  )
}

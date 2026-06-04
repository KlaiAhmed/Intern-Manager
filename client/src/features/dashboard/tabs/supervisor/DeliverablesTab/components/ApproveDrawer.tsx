import { useState } from 'react'
import { format } from 'date-fns'

import { Avatar } from '@/features/dashboard/components/Avatar/Avatar'
import { DashboardButton } from '@/features/dashboard/components/DashboardButton'
import { Drawer } from '@/features/dashboard/components/Drawer/Drawer'
import { Download, Eye } from '@/features/dashboard/components/IconComponents'
import type { ToastTone } from '@/features/dashboard/components/Toast/useToast'
import type { SupervisorDeliverable, SupervisorIntern } from '@/features/dashboard/types/supervisorDashboard'
import { useI18n } from '@/locales/I18nContext'

import { ConflictError } from '../hooks/useDeliverablesData'
import { getCurrentVersion } from './InternDeliverableCard'

interface ApproveDrawerProps {
  deliverable: SupervisorDeliverable
  intern: SupervisorIntern | undefined
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  approveDeliverable: (id: string, rowVersion: string) => Promise<void>
  showToast: (message: string, tone: ToastTone) => void
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return format(date, 'MMM d, yyyy HH:mm')
}

function getInternName(deliverable: SupervisorDeliverable, intern: SupervisorIntern | undefined): string {
  return intern?.fullName || deliverable.internName || 'Unassigned intern'
}

export function ApproveDrawer({
  deliverable,
  intern,
  isOpen,
  onClose,
  onSuccess,
  approveDeliverable,
  showToast,
}: ApproveDrawerProps) {
  const { t } = useI18n()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const internName = getInternName(deliverable, intern)
  const currentVersion = getCurrentVersion(deliverable)

  const handleSubmit = async () => {
    setIsSubmitting(true)

    try {
      await approveDeliverable(deliverable.id, deliverable.rowVersion ?? '')
      showToast(t('dashboard.supervisor.toast.approveSuccess'), 'success')
      onSuccess()
    } catch (error) {
      if (error instanceof ConflictError) {
        showToast(t('dashboard.supervisor.toast.concurrentEdit'), 'error')
        return
      }

      showToast(t('dashboard.supervisor.error.approve'), 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('dashboard.supervisor.deliverables.approveTitle')}
      width="md"
      footer={(
        <>
          <DashboardButton type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            {t('dashboard.form.cancel')}
          </DashboardButton>
          <DashboardButton type="button" variant="primary" loading={isSubmitting} onClick={() => void handleSubmit()}>
            {t('dashboard.supervisor.deliverables.approve')}
          </DashboardButton>
        </>
      )}
    >
      <div className="supervisor-deliverable-drawer">
        <div className="supervisor-deliverable-drawer__context">
          <Avatar name={internName} size="md" />
          <div>
            <strong>{internName}</strong>
            <span>{deliverable.title}</span>
          </div>
        </div>

        <dl className="supervisor-deliverable-drawer__details">
          <div>
            <dt>{t('dashboard.supervisor.deliverables.version')}</dt>
            <dd>{currentVersion ? `v${currentVersion.versionNumber}` : `v${deliverable.version}`}</dd>
          </div>
          <div>
            <dt>{t('dashboard.supervisor.deliverables.submissionDate')}</dt>
            <dd>{formatDateTime(deliverable.submittedDate ?? currentVersion?.submittedAt)}</dd>
          </div>
        </dl>

        <div className="supervisor-deliverable-drawer__links">
          {currentVersion?.fileUrl && (
            <a href={currentVersion.fileUrl} target="_blank" rel="noopener noreferrer">
              <Download />
              <span>{t('dashboard.supervisor.deliverables.downloadFile')}</span>
            </a>
          )}
          {currentVersion?.gitHubUrl && (
            <a href={currentVersion.gitHubUrl} target="_blank" rel="noopener noreferrer">
              <Eye />
              <span>{t('dashboard.supervisor.deliverables.viewGithub')}</span>
            </a>
          )}
          {!currentVersion?.fileUrl && !currentVersion?.gitHubUrl && (
            <p className="supervisor-deliverable-drawer__muted">
              {t('dashboard.supervisor.deliverables.noSubmissionLink')}
            </p>
          )}
        </div>

        {currentVersion?.message && (
          <blockquote className="supervisor-deliverable-drawer__message">
            {currentVersion.message}
          </blockquote>
        )}
      </div>
    </Drawer>
  )
}

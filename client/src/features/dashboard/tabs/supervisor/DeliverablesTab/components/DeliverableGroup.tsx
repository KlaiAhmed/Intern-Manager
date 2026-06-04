import { useId, useState } from 'react'

import { ChevronDown } from '@/features/dashboard/components/IconComponents'
import { StatusBadge } from '@/features/dashboard/components/StatusBadge'
import { getDeliverableStatusTone } from '@/features/dashboard/shared/utils/supervisorUtils'
import type { SupervisorDeliverable, SupervisorIntern } from '@/features/dashboard/types/supervisorDashboard'
import { useI18n } from '@/locales/I18nContext'

import { getStatusLabel, InternDeliverableCard } from './InternDeliverableCard'

interface DeliverableGroupProps {
  deliverable: SupervisorDeliverable
  intern: SupervisorIntern | undefined
  onApprove: () => void
  onReject: () => void
}

export function DeliverableGroup({
  deliverable,
  intern,
  onApprove,
  onReject,
}: DeliverableGroupProps) {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(true)
  const bodyId = useId()
  const statusLabel = getStatusLabel(deliverable.status, t)

  return (
    <section className="supervisor-deliverable-group">
      <header className="supervisor-deliverable-group__header">
        <div className="supervisor-deliverable-group__title">
          <h2>{deliverable.title}</h2>
          <span>{t('dashboard.supervisor.deliverables.weight', { weight: deliverable.weight })}</span>
          <StatusBadge label={statusLabel} tone={getDeliverableStatusTone(deliverable.status)} size="sm" />
        </div>
        <button
          className="supervisor-deliverable-group__toggle"
          type="button"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          aria-label={isOpen ? t('dashboard.supervisor.deliverables.collapse') : t('dashboard.supervisor.deliverables.expand')}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span className={isOpen ? 'is-open' : ''} aria-hidden="true">
            <ChevronDown />
          </span>
        </button>
      </header>

      {isOpen && (
        <div id={bodyId} className="supervisor-deliverable-group__body">
          <InternDeliverableCard
            deliverable={deliverable}
            intern={intern}
            onApprove={onApprove}
            onReject={onReject}
          />
        </div>
      )}
    </section>
  )
}

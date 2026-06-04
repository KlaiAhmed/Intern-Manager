import { useMemo, useState } from 'react'

import { Input } from '@/components/ui/Input'
import { DashboardButton } from '@/features/dashboard/components/DashboardButton'
import { ErrorState } from '@/features/dashboard/components/ErrorState'
import { Panel } from '@/features/dashboard/components/Panel'
import { Search } from '@/features/dashboard/components/IconComponents'
import { Skeleton } from '@/features/dashboard/components/Skeleton'
import { Toast } from '@/features/dashboard/components/Toast/Toast'
import { useToast } from '@/features/dashboard/components/Toast/useToast'
import type {
  DeliverableStatus,
  SupervisorDeliverable,
  SupervisorIntern,
  SupervisorTask,
} from '@/features/dashboard/types/supervisorDashboard'
import { useI18n } from '@/locales/I18nContext'

import { ApproveDrawer } from './components/ApproveDrawer'
import { DeliverableGroup } from './components/DeliverableGroup'
import { getStatusLabel } from './components/InternDeliverableCard'
import { RejectDrawer } from './components/RejectDrawer'
import { useDeliverablesData } from './hooks/useDeliverablesData'

interface DeliverablesTabProps {
  missionId: string
}

type DeliverableFilterStatus = DeliverableStatus | 'all'
type DrawerMode = 'approve' | 'reject' | null

const statusFilterOrder: DeliverableFilterStatus[] = [
  'all',
  'draft',
  'in_progress',
  'awaiting_review',
  'approved',
  'changes_requested',
  'cancelled',
]

function findIntern(interns: SupervisorIntern[], deliverable: SupervisorDeliverable): SupervisorIntern | undefined {
  return interns.find((intern) => intern.id === deliverable.internId)
}

function collectLinkedTasks(deliverables: SupervisorDeliverable[]): SupervisorTask[] {
  return deliverables.flatMap((deliverable) => deliverable.tasks ?? [])
}

export function DeliverablesTab({ missionId }: DeliverablesTabProps) {
  const { t } = useI18n()
  const {
    data,
    isLoading,
    error,
    refresh,
    approveDeliverable,
    rejectDeliverable,
  } = useDeliverablesData(missionId)
  const { toasts, showToast, dismissToast } = useToast()
  const [filterInternId, setFilterInternId] = useState<string | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<DeliverableFilterStatus>('all')
  const [searchText, setSearchText] = useState('')
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null)
  const [selectedDeliverable, setSelectedDeliverable] = useState<SupervisorDeliverable | null>(null)

  const filteredDeliverables = useMemo(() => {
    let nextDeliverables = data.deliverables

    if (filterInternId !== 'all') {
      nextDeliverables = nextDeliverables.filter((deliverable) => deliverable.internId === filterInternId)
    }

    if (filterStatus !== 'all') {
      nextDeliverables = nextDeliverables.filter((deliverable) => deliverable.status === filterStatus)
    }

    const normalizedSearch = searchText.trim().toLocaleLowerCase()
    if (normalizedSearch) {
      nextDeliverables = nextDeliverables.filter((deliverable) =>
        deliverable.title.toLocaleLowerCase().includes(normalizedSearch),
      )
    }

    return nextDeliverables
  }, [data.deliverables, filterInternId, filterStatus, searchText])

  const linkedTasks = useMemo(() => collectLinkedTasks(data.deliverables), [data.deliverables])

  const openDrawer = (mode: Exclude<DrawerMode, null>, deliverable: SupervisorDeliverable) => {
    setSelectedDeliverable(deliverable)
    setDrawerMode(mode)
  }

  const closeDrawer = () => {
    setDrawerMode(null)
    setSelectedDeliverable(null)
  }

  if (isLoading) {
    return (
      <Panel title={t('dashboard.supervisor.deliverables.reviewTitle')}>
        <div className="supervisor-deliverables-skeleton">
          <Skeleton height="44px" />
          <Skeleton height="132px" />
          <Skeleton height="132px" />
        </div>
      </Panel>
    )
  }

  if (error) {
    return <ErrorState message={error} onRetry={() => { void refresh() }} />
  }

  return (
    <>
      <Panel title={t('dashboard.supervisor.deliverables.reviewTitle')}>
        <div className="supervisor-deliverables-tab">
          <div className="supervisor-deliverables-toolbar">
            <label className="supervisor-deliverables-toolbar__select">
              <span>{t('dashboard.form.intern')}</span>
              <select
                className="dash-input dash-select"
                value={filterInternId}
                onChange={(event) => setFilterInternId(event.target.value)}
              >
                <option value="all">{t('dashboard.supervisor.deliverables.allInterns')}</option>
                {data.interns.map((intern) => (
                  <option key={intern.id} value={intern.id}>
                    {intern.fullName}
                  </option>
                ))}
              </select>
            </label>

            <div className="supervisor-deliverables-toolbar__status" aria-label={t('dashboard.supervisor.deliverables.statusFilter')}>
              {statusFilterOrder.map((status) => (
                <DashboardButton
                  key={status}
                  type="button"
                  variant={filterStatus === status ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterStatus(status)}
                >
                  {status === 'all' ? t('dashboard.supervisor.deliverables.status.all') : getStatusLabel(status, t)}
                </DashboardButton>
              ))}
            </div>

            <Input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder={t('dashboard.supervisor.deliverables.searchPlaceholder')}
              leftIcon={<Search />}
              aria-label={t('dashboard.supervisor.deliverables.searchLabel')}
            />

            <p className="supervisor-deliverables-toolbar__count">
              {t('dashboard.supervisor.deliverables.showingCount', {
                filteredCount: filteredDeliverables.length,
                totalCount: data.deliverables.length,
              })}
            </p>
          </div>

          {filteredDeliverables.length > 0 ? (
            <div className="supervisor-deliverables-list">
              {filteredDeliverables.map((deliverable) => (
                <DeliverableGroup
                  key={deliverable.id}
                  deliverable={deliverable}
                  intern={findIntern(data.interns, deliverable)}
                  onApprove={() => openDrawer('approve', deliverable)}
                  onReject={() => openDrawer('reject', deliverable)}
                />
              ))}
            </div>
          ) : (
            <div className="dash-empty">
              <h3 className="dash-empty-title">{t('dashboard.supervisor.deliverables.emptyTitle')}</h3>
              <p className="dash-empty-description">{t('dashboard.supervisor.deliverables.emptyMessage')}</p>
            </div>
          )}
        </div>
      </Panel>

      {selectedDeliverable && drawerMode === 'approve' && (
        <ApproveDrawer
          deliverable={selectedDeliverable}
          intern={findIntern(data.interns, selectedDeliverable)}
          isOpen
          onClose={closeDrawer}
          onSuccess={closeDrawer}
          approveDeliverable={approveDeliverable}
          showToast={showToast}
        />
      )}

      {selectedDeliverable && drawerMode === 'reject' && (
        <RejectDrawer
          deliverable={selectedDeliverable}
          intern={findIntern(data.interns, selectedDeliverable)}
          tasks={linkedTasks}
          isOpen
          onClose={closeDrawer}
          onSuccess={closeDrawer}
          rejectDeliverable={rejectDeliverable}
          showToast={showToast}
        />
      )}

      <Toast toasts={toasts} onDismiss={dismissToast} />
    </>
  )
}

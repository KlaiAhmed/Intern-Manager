import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useI18n } from '@/locales/I18nContext'
import { useNavigate } from 'react-router-dom'
import { DashboardButton } from '../../../components/DashboardButton'
import { ErrorState } from '../../../components/ErrorState'
import { Skeleton } from '../../../components/Skeleton'
import type { BiActionQueueResponse, BiSectionData } from '../../types/biDashboard'
import styles from '../BiDashboardSection.module.css'

interface Props { data: BiSectionData<BiActionQueueResponse>; }

type ActionPriority = BiActionQueueResponse['items'][number]['priority']

type ActionRowStyle = CSSProperties & {
  '--bi-action-color': string
  '--bi-action-badge-bg': string
  '--bi-action-badge-color': string
}

const priorityStyles: Record<ActionPriority, ActionRowStyle> = {
  high: {
    '--bi-action-color': '#A32D2D',
    '--bi-action-badge-bg': '#FCEBEB',
    '--bi-action-badge-color': '#791F1F',
  },
  medium: {
    '--bi-action-color': '#BA7517',
    '--bi-action-badge-bg': '#FAEEDA',
    '--bi-action-badge-color': '#633806',
  },
  low: {
    '--bi-action-color': '#185FA5',
    '--bi-action-badge-bg': '#E6F1FB',
    '--bi-action-badge-color': '#185FA5',
  },
}

const operationalStyle: ActionRowStyle = {
  '--bi-action-color': '#1D9E75',
  '--bi-action-badge-bg': '#E7F6F1',
  '--bi-action-badge-color': '#12694F',
}

const priorityRank: Record<ActionPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

function formatTimestamp(timestamp: Date | null) {
  if (!timestamp) {
    return '-'
  }

  return timestamp.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function S9_ActionQueue({ data }: Props) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null)

  useEffect(() => {
    if (data.data) {
      const timerId = window.setTimeout(() => {
        setLastRefreshedAt(new Date())
      }, 0)

      return () => window.clearTimeout(timerId)
    }
  }, [data.data])

  const sortedItems = useMemo(() => {
    if (!data.data) {
      return []
    }

    return [...data.data.items].sort((a, b) => {
      const aHasCount = a.count !== 0
      const bHasCount = b.count !== 0

      if (aHasCount !== bHasCount) {
        return aHasCount ? -1 : 1
      }

      const priorityDelta = priorityRank[a.priority] - priorityRank[b.priority]

      if (priorityDelta !== 0) {
        return priorityDelta
      }

      return b.count - a.count
    })
  }, [data.data])

  if (data.loading) {
    return <Skeleton height="240px" />
  }

  if (data.error) {
    return <ErrorState message={data.error} onRetry={data.refetch} />
  }

  if (!data.data) {
    return <div className={styles.emptyState}>{t('dashboard.bi.actions.noData')}</div>
  }

  const allClear = sortedItems.every((item) => item.count === 0)

  const handleRefresh = () => {
    data.refetch()
  }

  return (
    <div className={styles.actionQueue}>
      <div className={styles.actionRows} role="list">
        {allClear && (
          <div className={styles.actionRow} role="listitem" style={operationalStyle}>
            <span className={styles.actionDot} aria-hidden="true" />
            <div className={styles.actionContent}>
              <p className={styles.actionMessage}>{t('dashboard.bi.actions.allClear')}</p>
            </div>
            <div className={styles.actionMeta}>
              <span className={styles.actionBadge}>{t('dashboard.bi.actions.badge.operational')}</span>
            </div>
          </div>
        )}

        {sortedItems.map((item) => {
          const isEmpty = item.count === 0
          const rowClassName = `${styles.actionRow} ${isEmpty ? styles.actionRowDimmed : ''}`.trim()

          return (
            <div className={rowClassName} key={`${item.type}-${item.actionUrl}`} role="listitem" style={priorityStyles[item.priority]}>
              <span className={styles.actionDot} aria-hidden="true" />
              <div className={styles.actionContent}>
                <p className={styles.actionMessage}>
                  {t(`dashboard.bi.actions.msg.${item.type}`, { count: item.count })}
                </p>
                <span className={styles.actionType}>{item.type}</span>
              </div>
              <div className={styles.actionMeta}>
                <span className={styles.actionBadge}>{item.count.toLocaleString()}</span>
                <button className={styles.actionLink} type="button" onClick={() => navigate(item.actionUrl)}>
                  {t('dashboard.bi.actions.view')}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <footer className={styles.actionFooter}>
        <span className={styles.refreshTimestamp}>
          {t('dashboard.bi.actions.refreshed', { time: formatTimestamp(lastRefreshedAt) })}
        </span>
        <DashboardButton type="button" variant="secondary" size="sm" onClick={handleRefresh}>
          {t('dashboard.bi.actions.refresh')}
        </DashboardButton>
      </footer>
    </div>
  )
}

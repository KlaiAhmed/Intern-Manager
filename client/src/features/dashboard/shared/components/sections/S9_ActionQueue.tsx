import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useI18n } from '@/locales/I18nContext'
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

      if (aHasCount === bHasCount) {
        return 0
      }

      return aHasCount ? -1 : 1
    })
  }, [data.data])

  if (data.loading) {
    return <Skeleton height="240px" />
  }

  if (data.error) {
    return <ErrorState message={data.error} onRetry={data.refetch} />
  }

  if (!data.data) {
    return null
  }

  const handleRefresh = () => {
    data.refetch()
  }

  return (
    <div className={styles.actionQueue}>
      <div className={styles.actionRows} role="list">
        {sortedItems.map((item) => {
          const isEmpty = item.count === 0
          const rowClassName = `${styles.actionRow} ${isEmpty ? styles.actionRowDimmed : ''}`.trim()

          return (
            <div className={rowClassName} key={`${item.type}-${item.actionUrl}`} role="listitem" style={priorityStyles[item.priority]}>
              <span className={styles.actionDot} aria-hidden="true" />
              <div className={styles.actionContent}>
                <p className={styles.actionMessage}>{item.message}</p>
                <span className={styles.actionType}>{item.type}</span>
              </div>
              <div className={styles.actionMeta}>
                <span className={styles.actionBadge}>{item.count}</span>
                <a className={styles.actionLink} href={item.actionUrl}>
                  {t('dashboard.bi.actionQueue.view')}
                </a>
              </div>
            </div>
          )
        })}
      </div>

      <footer className={styles.actionFooter}>
        <span className={styles.refreshTimestamp}>
          {t('dashboard.bi.actionQueue.lastRefreshed', { timestamp: formatTimestamp(lastRefreshedAt) })}
        </span>
        <DashboardButton type="button" variant="secondary" size="sm" onClick={handleRefresh}>
          {t('dashboard.bi.actionQueue.refresh')}
        </DashboardButton>
      </footer>
    </div>
  )
}

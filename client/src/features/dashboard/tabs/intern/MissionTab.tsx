import { useMemo } from 'react'

import { buildApiUrl } from '../../../../lib/apiClient'
import { internDashboardApi } from '../../api/internDashboardApi'
import { useInternMissionDocuments } from '../../hooks/intern/useInternMission'
import type { InternMissionDocumentResponse } from '../../types/intern.types'
import type { Internship, TranslateFn } from '../../types/internDashboard'
import { InternTabEmpty, InternTabError, InternTabLoading } from './InternTabStates'

interface MissionTabProps {
  internship: Internship | null
  loading: boolean
  error: string | null
  onRetry: () => void
  t: TranslateFn
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
}

function isSafeExternalUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function resolveSourceType(sourceType: string | undefined): 'file' | 'url' {
  return sourceType === 'url' ? 'url' : 'file'
}

function resolveFallbackText(t: TranslateFn, value: string | null | undefined): string {
  if (value && value.trim().length > 0) {
    return value
  }
  return t('dashboard.noData')
}

export function MissionTab({
  internship,
  loading,
  error,
  onRetry,
  t,
}: MissionTabProps) {
  const missionId = internship?.id ?? null
  const resourcesQuery = useInternMissionDocuments(missionId, {
    enabled: !loading && !error && Boolean(missionId),
  })

  const sortedDocuments = useMemo(() => {
    return [...resourcesQuery.documents].sort((left, right) =>
      right.uploadedAt.localeCompare(left.uploadedAt),
    )
  }, [resourcesQuery.documents])

  if (loading) {
    return <InternTabLoading label={t('dashboard.intern.tabs.loading')} />
  }

  if (error) {
    return (
      <InternTabError
        title={t('dashboard.intern.tabs.errorTitle')}
        message={error}
        retryLabel={t('dashboard.intern.error.retry')}
        onRetry={onRetry}
      />
    )
  }

  if (!internship?.missionTitle) {
    return (
      <InternTabEmpty
        title={t('dashboard.intern.mission.emptyTitle')}
        message={t('dashboard.intern.mission.emptyMessage')}
      />
    )
  }

  return (
    <div className="intern-tab-stack">
      <section className="intern-panel">
        <div className="intern-section-header">
          <div>
            <p className="intern-eyebrow">{t('dashboard.intern.mission.details')}</p>
            <h2>{internship.missionTitle}</h2>
          </div>
          <span className="intern-status-pill">{internship.status}</span>
        </div>

        <dl className="intern-detail-list intern-detail-list-wide">
          <div>
            <dt>{t('dashboard.intern.mission.supervisor')}</dt>
            <dd>{internship.supervisorName || '-'}</dd>
          </div>
          {internship.coSupervisorName && (
            <div>
              <dt>{t('dashboard.intern.mission.coSupervisor')}</dt>
              <dd>{internship.coSupervisorName}</dd>
            </div>
          )}
          <div>
            <dt>{t('dashboard.intern.mission.department')}</dt>
            <dd>{internship.department || '-'}</dd>
          </div>
          <div>
            <dt>{t('dashboard.intern.mission.startDate')}</dt>
            <dd>{formatDate(internship.startDate)}</dd>
          </div>
          <div>
            <dt>{t('dashboard.intern.mission.endDate')}</dt>
            <dd>{formatDate(internship.endDate)}</dd>
          </div>
          <div>
            <dt>{t('dashboard.intern.mission.progress')}</dt>
            <dd>{internship.progress}%</dd>
          </div>
        </dl>
      </section>

      <section className="intern-panel" aria-labelledby="intern-mission-resources-heading">
        <div className="intern-section-header">
          <div>
            <p className="intern-eyebrow">{t('dashboard.intern.mission.resources')}</p>
            <h3 id="intern-mission-resources-heading">{t('dashboard.intern.mission.resourcesTitle')}</h3>
          </div>
        </div>

        {resourcesQuery.error && (
          <div className="intern-resource-error" role="alert">
            <p className="intern-resource-error-message">
              {resourcesQuery.error instanceof Error
                ? resourcesQuery.error.message
                : t('dashboard.intern.mission.resourcesLoadFailed')}
            </p>
            <button
              type="button"
              className="intern-resource-retry"
              onClick={() => { void resourcesQuery.refetch() }}
            >
              {t('dashboard.intern.error.retry')}
            </button>
          </div>
        )}

        {resourcesQuery.isLoading ? (
          <div className="intern-resource-loading" role="status" aria-live="polite">
            <div className="intern-resource-spinner" aria-hidden="true" />
            <span>{t('dashboard.intern.mission.resourcesLoading')}</span>
          </div>
        ) : resourcesQuery.error ? null : sortedDocuments.length === 0 ? (
          <p className="intern-resource-empty">{t('dashboard.intern.mission.resourcesEmpty')}</p>
        ) : (
          <ul className="intern-resource-list">
            {sortedDocuments.map((document) => (
              <ResourceRow
                key={document.id}
                document={document}
                missionId={missionId ?? ''}
                t={t}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

interface ResourceRowProps {
  document: InternMissionDocumentResponse
  missionId: string
  t: TranslateFn
}

function ResourceRow({ document, missionId, t }: ResourceRowProps) {
  const source = resolveSourceType(document.sourceType)
  const isFile = source === 'file'
  const displayName = resolveFallbackText(t, document.fileName)
  const uploadedAtLabel = formatDate(document.uploadedAt)

  const sourceLabel = isFile
    ? t('dashboard.intern.mission.resourceSource.file')
    : t('dashboard.intern.mission.resourceSource.url')

  const actionLabel = isFile
    ? t('dashboard.intern.mission.resourceDownload')
    : t('dashboard.intern.mission.resourceOpen')

  const href = isFile
    ? buildApiUrl(internDashboardApi.buildMissionDocumentDownloadUrl(missionId, document.id))
    : isSafeExternalUrl(document.fileUrl ?? '')
      ? (document.fileUrl as string)
      : ''

  if (!href) {
    return (
      <li className="intern-resource-row">
        <div className="intern-resource-row-main">
          <span className="intern-resource-name" title={displayName}>
            {displayName}
          </span>
          <span className="intern-resource-meta">
            <span className={`intern-resource-source intern-resource-source-${source}`}>
              {sourceLabel}
            </span>
            <span>{uploadedAtLabel}</span>
          </span>
        </div>
        <div className="intern-resource-actions">
          <span className="intern-resource-unavailable">
            {t('dashboard.intern.mission.resourceUnavailable')}
          </span>
        </div>
      </li>
    )
  }

  return (
    <li className="intern-resource-row">
      <div className="intern-resource-row-main">
        <span className="intern-resource-name" title={displayName}>
          {displayName}
        </span>
        <span className="intern-resource-meta">
          <span className={`intern-resource-source intern-resource-source-${source}`}>
            {sourceLabel}
          </span>
          <span>{uploadedAtLabel}</span>
        </span>
      </div>
      <div className="intern-resource-actions">
        <a
          className="intern-resource-link"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          download={isFile ? document.fileName : undefined}
        >
          {actionLabel}
        </a>
      </div>
    </li>
  )
}

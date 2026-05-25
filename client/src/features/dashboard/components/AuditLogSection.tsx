import { useState } from 'react'
import { useI18n } from '../../../locales/I18nContext'
import { useAuditLogs } from '../hooks/useAuditLogs'
import { Skeleton } from './Skeleton'
import { ErrorState } from './ErrorState'
import { Search, Filter, Download } from './IconComponents'
import { Input } from '../../../components/ui/Input'

const getActionBadgeClass = (action: string): string => {
  const classes: Record<string, string> = {
    CREATE: 'action-create',
    UPDATE: 'action-update',
    DELETE: 'action-delete',
    LOGIN: 'action-login',
    LOGOUT: 'action-logout',
    ASSIGN: 'action-assign',
    VALIDATE: 'action-validate',
  }
  return classes[action] || 'action-default'
}

export function AuditLogSection() {
  const { t } = useI18n()

  const actionOptions = [
    { value: '', label: t('dashboard.audit.actionOptions.allActions') },
    { value: 'CREATE', label: t('dashboard.audit.actionOptions.create') },
    { value: 'UPDATE', label: t('dashboard.audit.actionOptions.update') },
    { value: 'DELETE', label: t('dashboard.audit.actionOptions.delete') },
    { value: 'LOGIN', label: t('dashboard.audit.actionOptions.login') },
    { value: 'LOGOUT', label: t('dashboard.audit.actionOptions.logout') },
    { value: 'ASSIGN', label: t('dashboard.audit.actionOptions.assign') },
    { value: 'VALIDATE', label: t('dashboard.audit.actionOptions.validate') },
  ]

  const {
    logs,
    loading,
    error,
    page,
    totalPages,
    filter,
    setFilter,
    goToPage,
    refresh,
    exportAll,
    exporting,
  } = useAuditLogs()

  const [actorInput, setActorInput] = useState(filter.actor)

  return (
    <section className="super-admin-section audit-section">
      {/* Header */}
      <header className="section-header-row">
        <div className="section-header-text">
          <h2 className="section-title">{t('dashboard.superAdmin.auditSecurity')}</h2>
          <p className="section-subtitle">{t('dashboard.superAdmin.auditDesc')}</p>
        </div>
        <button
          className="dash-btn dash-btn-secondary dash-btn-md"
          onClick={() => void exportAll()}
          disabled={exporting}
        >
          <span className="btn-icon"><Download /></span>
          <span>{exporting ? t('dashboard.audit.exporting') : t('dashboard.audit.export')}</span>
        </button>
      </header>

      {/* Filters */}
      <div className="audit-filters">
        <div className="filter-row">
          <Input
            leftIcon={<Search />}
            placeholder={t('dashboard.audit.searchActor')}
            value={actorInput}
            onChange={(e) => setActorInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && setFilter({ actor: actorInput })}
            className="audit-search-input"
          />

          <div className="filter-select-wrapper">
            <span className="filter-icon"><Filter /></span>
            <select
              className="dash-input dash-select filter-select"
              value={filter.action}
              onChange={(e) => setFilter({ action: e.target.value })}
            >
              {actionOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="skeleton-block">
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : logs.length === 0 ? (
        <div className="dash-empty">
          <p>{t('dashboard.audit.noLogs')}</p>
          {(filter.actor || filter.action) && (
            <button
              className="dash-btn dash-btn-secondary dash-btn-md audit-clear-filters-btn"
              onClick={() => {
                setActorInput('')
                setFilter({ actor: '', action: '' })
              }}
            >
              {t('dashboard.audit.clearFilters')}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="table-wrapper audit-table-wrapper">
            <table className="dash-table audit-table">
              <thead>
                <tr>
<th>{t('dashboard.audit.actor')}</th>
          <th>{t('dashboard.audit.action')}</th>
          <th>{t('dashboard.audit.entity')}</th>
          <th>{t('dashboard.audit.timestamp')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div className="audit-actor-cell">
                        <div className="user-avatar">{log.actor.charAt(0).toUpperCase()}</div>
                        <span className="audit-actor">{log.actor}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`action-badge ${getActionBadgeClass(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td>
                      <span className="audit-entity">{log.entity}</span>
                    </td>
                    <td>
                      <div className="audit-timestamp">
                        <div className="audit-date">
                          {new Date(log.timestamp).toLocaleDateString()}
                        </div>
                        <div className="audit-time">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="table-pagination">
              <button
                className="dash-btn dash-btn-secondary dash-btn-sm"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
              >
                ← {t('dashboard.table.previous')}
              </button>
              <span className="pagination-info">
                {t('dashboard.table.page')} {page} {t('dashboard.table.of')} {totalPages}
              </span>
              <button
                className="dash-btn dash-btn-secondary dash-btn-sm"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
              >
                {t('dashboard.table.next')} →
              </button>
            </div>
          )}
        </>
      )}
    </section>
  )
}

import { useI18n } from '../../../../locales/I18nContext'
import { ErrorState } from '../../components/ErrorState'
import { Panel } from '../../components/Panel'
import { Skeleton } from '../../components/Skeleton'
import { StatusBadge } from '../../components/StatusBadge'
import type { Intern } from './types'

interface InternsTabProps {
  loadingInterns: boolean
  internsError: string | null
  filteredInterns: Intern[]
  selectedDepartment: string
  setSelectedDepartment: (value: string) => void
  selectedVerificationStatus: string
  setSelectedVerificationStatus: (value: string) => void
  internsSearch: string
  setInternsSearch: (value: string) => void
  departmentOptions: string[]
  verificationStatusOptions: string[]
  loadingDepartments: boolean
  departmentsError: string | null
  getInitials: (name: string) => string
  openInternModal: (intern: Intern) => void
  openAssignModal: (intern: Intern) => void
  viewInternCv: (internId: string) => Promise<void>
  loadInterns: () => Promise<void>
}

function toDisplayLabel(value: string): string {
  const normalized = value.trim()
  if (!normalized) return 'Unknown'

  return normalized
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .split(' ')
    .filter((token) => token.length > 0)
    .map((token) => token[0].toUpperCase() + token.slice(1))
    .join(' ')
}

function toVerificationTone(rawValue: string): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  const normalized = rawValue.trim().toLowerCase().replace(/[_-]/g, ' ')

  if (!normalized || normalized === 'unknown') return 'neutral'
  if (normalized.includes('pending') || normalized.includes('incomplete')) return 'warning'
  if (normalized.includes('active') || normalized.includes('verified') || normalized.includes('approved')) return 'success'
  if (normalized.includes('rejected') || normalized.includes('denied')) return 'danger'

  return 'info'
}

function isVerificationActive(rawValue: string | undefined): boolean {
  const normalized = (rawValue ?? '').trim().toLowerCase().replace(/[_-]/g, ' ')
  return normalized.includes('active') || normalized.includes('verified') || normalized.includes('approved')
}

function isAssignEnabled(rawValue: string | undefined): boolean {
  const normalized = (rawValue ?? '').trim().toLowerCase().replace(/[_-]/g, ' ')
  return normalized.includes('pending') || normalized.includes('incomplete')
}

function isCvEnabled(rawValue: string | undefined): boolean {
  const normalized = (rawValue ?? '').trim().toLowerCase().replace(/[_-]/g, ' ')
  return normalized.includes('active') || normalized.includes('verified') || normalized.includes('approved') || normalized.includes('pending')
}

export function InternsTab({
  loadingInterns,
  internsError,
  filteredInterns,
  selectedDepartment,
  setSelectedDepartment,
  selectedVerificationStatus,
  setSelectedVerificationStatus,
  internsSearch,
  setInternsSearch,
  departmentOptions,
  verificationStatusOptions,
  loadingDepartments,
  departmentsError,
  getInitials,
  openInternModal,
  openAssignModal,
  viewInternCv,
  loadInterns,
}: InternsTabProps) {
  const { t } = useI18n()
  return (
    <div className="dash-section" role="tabpanel" id="tabpanel-interns" aria-labelledby="tab-interns">
      <Panel
        title={t('dashboard.manager.interns.title')}
        actions={
          <div className="dash-filter-row">
            <input
              type="text"
              placeholder={t('dashboard.manager.interns.searchPlaceholder')}
              value={internsSearch}
              onChange={(event) => setInternsSearch(event.target.value)}
              className="dash-input dash-input-search-wide"
            />
            <select
              value={selectedDepartment}
              onChange={(event) => setSelectedDepartment(event.target.value)}
              className="dash-input dash-select"
              disabled={loadingDepartments}
            >
              {loadingDepartments
                ? <option value="all">{t('dashboard.manager.interns.loadingDepartments')}</option>
                : <option value="all">{t('dashboard.manager.interns.allDepartments')}</option>}
              {!loadingDepartments && departmentOptions.filter((option) => option !== 'all').map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
            <select
              value={selectedVerificationStatus}
              onChange={(event) => setSelectedVerificationStatus(event.target.value)}
              className="dash-input dash-select"
            >
              <option value="all">{t('dashboard.manager.interns.allVerificationStatuses')}</option>
              {verificationStatusOptions.filter((option) => option !== 'all').map((status) => (
                <option key={status} value={status}>{toDisplayLabel(status)}</option>
              ))}
            </select>
          </div>
        }
        className="dash-panel-table"
      >
        {departmentsError && (
          <p className="dash-filter-error" role="alert">{departmentsError}</p>
        )}

        {loadingInterns ? (
          <Skeleton height="400px" />
        ) : internsError ? (
          <ErrorState message={internsError} onRetry={loadInterns} />
        ) : filteredInterns.length === 0 ? (
          <div className="dash-empty">
            <div className="dash-empty-icon">∅</div>
            <h3 className="dash-empty-title">{t('dashboard.manager.interns.empty')}</h3>
            <p className="dash-empty-description">{t('dashboard.manager.interns.emptyDesc')}</p>
          </div>
        ) : (
          <div className="dash-table-wrapper">
            <table className="dash-table dash-table-to-cards">
              <thead>
                <tr>
                  <th className="col-name">{t('dashboard.manager.interns.table.name')}</th>
                  <th>{t('dashboard.manager.interns.table.department')}</th>
                  <th>{t('dashboard.manager.interns.table.mission')}</th>
                  <th>{t('dashboard.manager.interns.table.supervisor')}</th>
                  <th className="col-progress">{t('dashboard.manager.interns.table.progress')}</th>
                  <th>{t('dashboard.manager.interns.table.verificationStatus')}</th>
                  <th className="col-actions">{t('dashboard.manager.interns.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredInterns.map((intern) => (
                  <tr key={intern.id}>
                    <td data-label={t('dashboard.manager.interns.table.name')}>
                      <div className="intern-cell">
                        <span className="intern-avatar" aria-hidden="true">{getInitials(intern.name)}</span>
                        <div className="intern-info">
                          <span className="intern-name">{intern.name}</span>
                          <span className="intern-email">{intern.email}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label={t('dashboard.manager.interns.table.department')}>{intern.department || '-'}</td>
                    <td data-label={t('dashboard.manager.interns.table.mission')}>{intern.missionTitle || '-'}</td>
                    <td data-label={t('dashboard.manager.interns.table.supervisor')}>{intern.supervisorName || '-'}</td>
                    <td data-label={t('dashboard.manager.interns.table.progress')}>
                      {isVerificationActive(intern.verificationStatus) ? (
                        <div className="table-progress">
                          <div className="dash-progress">
                            <div
                              className={`dash-progress-fill ${intern.status === 'completed' ? 'dash-progress-fill-success' : ''}`}
                              style={{ width: `${intern.progress}%` }}
                            />
                          </div>
                          <span>{intern.progress}%</span>
                        </div>
                      ) : '-'}
                    </td>
                    <td data-label={t('dashboard.manager.interns.table.verificationStatus')}>
                      <StatusBadge
                        label={toDisplayLabel(intern.verificationStatus || 'Unknown')}
                        tone={toVerificationTone(intern.verificationStatus || 'Unknown')}
                        size="sm"
                      />
                    </td>
                    <td data-label={t('dashboard.manager.interns.table.actions')} className="cell-actions">
                      <button
                        type="button"
                        className="intern-action-btn"
                        onClick={() => openInternModal(intern)}
                        aria-label={t('dashboard.manager.interns.viewDetails').replace('{{name}}', intern.name)}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`intern-action-btn ${!isCvEnabled(intern.verificationStatus) ? 'intern-action-btn--disabled' : ''}`}
                        disabled={!isCvEnabled(intern.verificationStatus)}
                        onClick={() => void viewInternCv(intern.id)}
                        aria-label={t('dashboard.manager.interns.viewCv').replace('{{name}}', intern.name)}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <polyline points="10 9 9 9 8 9" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className={`intern-action-btn ${!isAssignEnabled(intern.verificationStatus) ? 'intern-action-btn--disabled' : ''}`}
                        disabled={!isAssignEnabled(intern.verificationStatus)}
                        onClick={() => isAssignEnabled(intern.verificationStatus) && openAssignModal(intern)}
                        aria-label={t('dashboard.manager.interns.assignIntern').replace('{{name}}', intern.name)}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="8.5" cy="7" r="4" />
                          <line x1="20" y1="8" x2="20" y2="14" />
                          <line x1="23" y1="11" x2="17" y2="11" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

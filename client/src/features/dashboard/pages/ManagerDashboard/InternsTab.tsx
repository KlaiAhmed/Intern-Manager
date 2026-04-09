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
  loadInterns,
}: InternsTabProps) {
  return (
    <div className="dash-section" role="tabpanel" id="tabpanel-interns" aria-labelledby="tab-interns">
      <Panel
        title="Interns"
        actions={
          <div className="dash-filter-row">
            <input
              type="text"
              placeholder="Search by name or email"
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
                ? <option value="all">Loading departments...</option>
                : <option value="all">All departments</option>}
              {!loadingDepartments && departmentOptions.filter((option) => option !== 'all').map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
            <select
              value={selectedVerificationStatus}
              onChange={(event) => setSelectedVerificationStatus(event.target.value)}
              className="dash-input dash-select"
            >
              <option value="all">All verification statuses</option>
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
            <h3 className="dash-empty-title">No interns found</h3>
            <p className="dash-empty-description">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="dash-table-wrapper">
            <table className="dash-table dash-table-to-cards">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Mission</th>
                  <th>Supervisor</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th>Verification Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInterns.map((intern) => (
                  <tr key={intern.id}>
                    <td data-label="Name">
                      <div className="intern-cell">
                        <span className="intern-avatar" aria-hidden="true">{getInitials(intern.name)}</span>
                        <div className="intern-info">
                          <span className="intern-name">{intern.name}</span>
                          <span className="intern-email">{intern.email}</span>
                        </div>
                      </div>
                    </td>
                    <td data-label="Department">{intern.department || '-'}</td>
                    <td data-label="Mission">{intern.missionTitle || '-'}</td>
                    <td data-label="Supervisor">{intern.supervisorName || '-'}</td>
                    <td data-label="Progress">
                      <div className="table-progress">
                        <div className="dash-progress">
                          <div
                            className={`dash-progress-fill ${intern.status === 'completed' ? 'dash-progress-fill-success' : ''}`}
                            style={{ width: `${intern.progress}%` }}
                          />
                        </div>
                        <span>{intern.progress}%</span>
                      </div>
                    </td>
                    <td data-label="Status">
                      <span className={`dash-status-badge dash-status-badge-${intern.status}`}>{intern.status}</span>
                    </td>
                    <td data-label="Verification Status">
                      <StatusBadge
                        label={toDisplayLabel(intern.verificationStatus || 'Unknown')}
                        tone={toVerificationTone(intern.verificationStatus || 'Unknown')}
                        size="sm"
                      />
                    </td>
                    <td data-label="Actions">
                      <button
                        type="button"
                        className="intern-action-btn"
                        onClick={() => openInternModal(intern)}
                        aria-label={`View details for ${intern.name}`}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
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

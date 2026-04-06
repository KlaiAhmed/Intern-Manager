import { ErrorState } from '../../components/ErrorState'
import { Panel } from '../../components/Panel'
import { Skeleton } from '../../components/Skeleton'
import type { Intern } from './types'

interface InternsTabProps {
  loadingInterns: boolean
  internsError: string | null
  filteredInterns: Intern[]
  selectedDepartment: string
  setSelectedDepartment: (value: string) => void
  internsSearch: string
  setInternsSearch: (value: string) => void
  departmentOptions: string[]
  getInitials: (name: string) => string
  openInternModal: (intern: Intern) => void
  loadInterns: () => Promise<void>
}

export function InternsTab({
  loadingInterns,
  internsError,
  filteredInterns,
  selectedDepartment,
  setSelectedDepartment,
  internsSearch,
  setInternsSearch,
  departmentOptions,
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
            >
              <option value="all">All departments</option>
              {departmentOptions.filter((option) => option !== 'all').map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </div>
        }
        className="dash-panel-table"
      >
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
                    <td data-label="Actions">
                      <button
                        className="view-button"
                        onClick={() => openInternModal(intern)}
                        aria-label={`View details for ${intern.name}`}
                      >
                        View
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

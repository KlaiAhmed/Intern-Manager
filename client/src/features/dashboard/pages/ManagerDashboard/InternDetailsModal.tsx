import { DashboardButton } from '../../components/DashboardButton'
import { Modal } from '../../components/Modal'
import type { Intern } from './types'

interface InternDetailsModalProps {
  isOpen: boolean
  intern: Intern | null
  onClose: () => void
  getInitials: (name: string) => string
}

export function InternDetailsModal({
  isOpen,
  intern,
  onClose,
  getInitials,
}: InternDetailsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={intern?.name || ''}>
      {intern && (
        <div className="intern-modal-content">
          <div className="intern-modal-header">
            <span className="intern-modal-avatar" aria-hidden="true">{getInitials(intern.name)}</span>
            <div className="intern-modal-info">
              <h3>{intern.name}</h3>
              <p className="intern-modal-email">{intern.email}</p>
            </div>
          </div>

          <div className="intern-modal-grid">
            <div className="intern-modal-field">
              <span className="intern-modal-label">Department</span>
              <span className="intern-modal-value">{intern.department || '-'}</span>
            </div>
            <div className="intern-modal-field">
              <span className="intern-modal-label">Mission</span>
              <span className="intern-modal-value">{intern.missionTitle || '-'}</span>
            </div>
            <div className="intern-modal-field">
              <span className="intern-modal-label">Supervisor</span>
              <span className="intern-modal-value">{intern.supervisorName || '-'}</span>
            </div>
            <div className="intern-modal-field">
              <span className="intern-modal-label">Start date</span>
              <span className="intern-modal-value">{intern.startDate || '-'}</span>
            </div>
            <div className="intern-modal-field">
              <span className="intern-modal-label">End date</span>
              <span className="intern-modal-value">{intern.endDate || '-'}</span>
            </div>
            <div className="intern-modal-field">
              <span className="intern-modal-label">Status</span>
              <span className={`dash-status-badge dash-status-badge-${intern.status}`}>{intern.status}</span>
            </div>
          </div>

          <div className="intern-modal-progress">
            <div className="intern-modal-progress-header">
              <span className="intern-modal-label">Progress</span>
              <span className="intern-modal-progress-value">{intern.progress}%</span>
            </div>
            <div className="dash-progress">
              <div
                className={`dash-progress-fill ${intern.status === 'completed' ? 'dash-progress-fill-success' : ''}`}
                style={{ width: `${intern.progress}%` }}
              />
            </div>
          </div>

          <div className="intern-modal-actions">
            <DashboardButton variant="secondary" onClick={onClose}>
              Close
            </DashboardButton>
            <DashboardButton variant="primary">View full profile</DashboardButton>
          </div>
        </div>
      )}
    </Modal>
  )
}

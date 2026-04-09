import { useCallback, useEffect, useState } from 'react'
import { DashboardButton } from '../../components/DashboardButton'
import { Skeleton } from '../../components/Skeleton'
import { pendingAdminServices } from '../services/pendingAdminServices'
import type { ArchiveHistoryRecord } from '../types/operations'
import { toDashboardErrorMessage } from '../utils/errorMessage'
import styles from './OperationalArchiveSection.module.css'

export function OperationalArchiveSection() {
  const [loading, setLoading] = useState(true)
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [history, setHistory] = useState<ArchiveHistoryRecord[]>([])

  const loadHistory = useCallback(async () => {
    setLoading(true)
    setBannerError(null)

    try {
      const payload = await pendingAdminServices.listArchiveHistory()
      setHistory(payload)
    } catch (requestError) {
      setBannerError(toDashboardErrorMessage(requestError))
      setHistory([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const triggerArchive = async () => {
    const confirmed = window.confirm('Trigger annual archive now?')
    if (!confirmed) {
      return
    }

    try {
      await pendingAdminServices.triggerArchive()
      await loadHistory()
    } catch (requestError) {
      setBannerError(toDashboardErrorMessage(requestError))
    }
  }

  return (
    <section className={`${styles.root} super-admin-section admin-view-section`} id="section-archive">
      <header className="section-header-row">
        <div className="section-header-text">
          <h2 className="section-title">Archive Manager</h2>
          <p className="section-subtitle">Trigger annual archive jobs and inspect archive history.</p>
        </div>
        <DashboardButton variant="primary" size="md" onClick={() => void triggerArchive()}>
          Trigger Annual Archive
        </DashboardButton>
      </header>

      {bannerError && <div className="admin-inline-banner">{bannerError}</div>}

      {loading ? (
        <Skeleton height="220px" />
      ) : history.length === 0 ? (
        <div className="dash-empty">
          <h3 className="dash-empty-title">No archive history yet</h3>
          <p className="dash-empty-description">Trigger an archive job to create the first history record.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="dash-table super-admin-table">
            <thead>
              <tr>
                <th>Year</th>
                <th>Triggered By</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{item.year}</td>
                  <td>{item.triggeredBy}</td>
                  <td>{new Date(item.triggeredAt).toLocaleString()}</td>
                  <td>{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

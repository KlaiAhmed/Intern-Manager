import { useCallback, useEffect, useState } from 'react'
import { DashboardButton } from '../../components/DashboardButton'
import { Skeleton } from '../../components/Skeleton'
import { pendingAdminServices } from '../services/pendingAdminServices'
import type { BiAccessMatrix } from '../types/operations'
import { dashboardColumns, roleRows } from '../types/operations'
import { toDashboardErrorMessage } from '../utils/errorMessage'
import styles from './OperationalBiAccessSection.module.css'

export function OperationalBiAccessSection() {
  const [loading, setLoading] = useState(true)
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [matrix, setMatrix] = useState<BiAccessMatrix[]>([])

  const createDefaultMatrix = (): BiAccessMatrix[] => {
    return roleRows.map((role) => {
      return {
        role,
        dashboards: dashboardColumns.reduce<Record<string, boolean>>((accumulator, dashboard) => {
          accumulator[dashboard] = false
          return accumulator
        }, {}),
      }
    })
  }

  const loadMatrix = useCallback(async () => {
    setLoading(true)
    setBannerError(null)

    try {
      const payload = await pendingAdminServices.listBiAccessMatrix()
      setMatrix(payload)
    } catch (requestError) {
      setBannerError(toDashboardErrorMessage(requestError))
      setMatrix(createDefaultMatrix())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMatrix()
  }, [loadMatrix])

  const toggleCell = (role: string, dashboard: string) => {
    setMatrix((prev) => {
      return prev.map((row) => {
        if (row.role !== role) {
          return row
        }

        return {
          ...row,
          dashboards: {
            ...row.dashboards,
            [dashboard]: !row.dashboards[dashboard],
          },
        }
      })
    })
  }

  const saveMatrix = async () => {
    try {
      await pendingAdminServices.saveBiAccessMatrix(matrix)
    } catch (requestError) {
      setBannerError(toDashboardErrorMessage(requestError))
    }
  }

  return (
    <section className={`${styles.root} super-admin-section admin-view-section`} id="section-bi-access">
      <header className="section-header-row">
        <div className="section-header-text">
          <h2 className="section-title">BI Access Control</h2>
          <p className="section-subtitle">Manage dashboard access grants by role using a permission matrix.</p>
        </div>
        <DashboardButton variant="primary" size="md" onClick={() => void saveMatrix()}>
          Save Access Matrix
        </DashboardButton>
      </header>

      {bannerError && <div className="admin-inline-banner">{bannerError}</div>}

      {loading ? (
        <Skeleton height="260px" />
      ) : matrix.length === 0 ? (
        <div className="dash-empty">
          <h3 className="dash-empty-title">No matrix data available</h3>
          <p className="dash-empty-description">Matrix data will be available when BI access endpoints are implemented.</p>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="dash-table super-admin-table">
            <thead>
              <tr>
                <th>Role</th>
                {dashboardColumns.map((dashboard) => (
                  <th key={dashboard}>{dashboard}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => (
                <tr key={row.role}>
                  <td>{row.role}</td>
                  {dashboardColumns.map((dashboard) => (
                    <td key={`${row.role}-${dashboard}`}>
                      <label className="admin-toggle">
                        <input
                          type="checkbox"
                          checked={Boolean(row.dashboards[dashboard])}
                          onChange={() => toggleCell(row.role, dashboard)}
                          title="Local toggle only until /api/admin/bi-access is implemented"
                        />
                        <span>{row.dashboards[dashboard] ? 'Granted' : 'Blocked'}</span>
                      </label>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

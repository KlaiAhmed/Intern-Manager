import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { Input } from '../../../../components/ui/Input'
import { Search } from '../../components/IconComponents'
import { ErrorState } from '../../components/ErrorState'
import { Modal } from '../../components/Modal'
import { Skeleton } from '../../components/Skeleton'
import { DashboardButton } from '../../components/DashboardButton'
import { useDashboardApi } from '../../hooks/useDashboardApi'
import { apiBaseUrl } from '../../../../lib/apiClient'
import type { InternApi, InternRecord, PagedResponse } from '../types/operations'
import { toDashboardErrorMessage } from '../utils/errorMessage'
import { mapInternApi } from '../utils/operations'
import styles from './OperationalInternsSection.module.css'

export function OperationalInternsSection() {
  const { t } = useI18n()
  const api = useDashboardApi()
  const pageSize = 10
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [interns, setInterns] = useState<InternRecord[]>([])
  const [searchFilter, setSearchFilter] = useState('')
  const [page, setPage] = useState(1)

  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [selectedIntern, setSelectedIntern] = useState<InternRecord | null>(null)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false)
  const [detailsInternId, setDetailsInternId] = useState<string | null>(null)

  const loadInterns = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const payload = await api.get<PagedResponse<InternApi>>('/api/interns?limit=500')
      const mappedInterns = (payload.data ?? [])
        .map(mapInternApi)
        .filter((intern): intern is InternRecord => intern !== null)

      setInterns(mappedInterns)
      setPage(1)
    } catch (requestError) {
      setError(toDashboardErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void loadInterns()
  }, [loadInterns])

  const filteredInterns = useMemo(() => {
    const normalizedSearch = searchFilter.trim().toLowerCase()

    if (!normalizedSearch) {
      return interns
    }

    return interns.filter((intern) => {
      return (
        intern.fullName.toLowerCase().includes(normalizedSearch)
        || intern.email.toLowerCase().includes(normalizedSearch)
        || intern.accountStatus.toLowerCase().includes(normalizedSearch)
        || intern.verificationStatus.toLowerCase().includes(normalizedSearch)
      )
    })
  }, [interns, searchFilter])

  const pagedInterns = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredInterns.slice(start, start + pageSize)
  }, [filteredInterns, page])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredInterns.length / pageSize))
  }, [filteredInterns.length])

  const openInternDetails = async (internId: string) => {
    setDetailsInternId(internId)
    setDetailsLoading(true)
    setDetailsError(null)
    setDetailsModalOpen(true)

    try {
      const payload = await api.get<InternApi>(`/api/interns/${internId}`)
      const mappedIntern = mapInternApi(payload)

      if (!mappedIntern) {
        throw new Error('Unable to read intern details.')
      }

      setSelectedIntern(mappedIntern)
    } catch (requestError) {
      setDetailsError(toDashboardErrorMessage(requestError))
      setSelectedIntern(null)
    } finally {
      setDetailsLoading(false)
    }
  }

  return (
    <section className={`${styles.root} super-admin-section admin-view-section`} id="section-interns">
      <header className="section-header-row">
        <div className="section-header-text">
          <h2 className="section-title">{t('dashboard.operational.interns.title')}</h2>
          <p className="section-subtitle">{t('dashboard.operational.interns.subtitle')}</p>
        </div>
      </header>

      <Input
        leftIcon={<Search />}
        placeholder={t('dashboard.operational.interns.searchPlaceholder')}
        value={searchFilter}
        onChange={(event) => setSearchFilter(event.target.value)}
        className="search-input-component"
      />

      {loading ? (
        <div className="skeleton-block">
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadInterns()} />
      ) : filteredInterns.length === 0 ? (
        <div className="dash-empty">
          <h3 className="dash-empty-title">{t('dashboard.operational.interns.empty')}</h3>
          <p className="dash-empty-description">{t('dashboard.operational.interns.emptyDesc')}</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="dash-table super-admin-table">
              <thead>
                <tr>
                  <th>{t('dashboard.operational.interns.table.name')}</th>
                  <th>{t('dashboard.operational.interns.table.email')}</th>
                  <th>{t('dashboard.operational.interns.table.accountStatus')}</th>
                  <th>{t('dashboard.operational.interns.table.verificationStatus')}</th>
                  <th>{t('dashboard.operational.interns.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {pagedInterns.map((intern) => (
                  <tr key={intern.id}>
                    <td>{intern.fullName}</td>
                    <td>{intern.email}</td>
                    <td>{intern.accountStatus}</td>
                    <td>{intern.verificationStatus}</td>
                    <td>
                      <button
                        className="dash-btn dash-btn-secondary dash-btn-sm"
                        onClick={() => void openInternDetails(intern.id)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="table-pagination">
              <DashboardButton variant="secondary" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                Previous
              </DashboardButton>
              <span className="pagination-info">{t('dashboard.table.page')} {page} {t('dashboard.table.of')} {totalPages}</span>
              <DashboardButton
                variant="secondary"
                size="sm"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Next
              </DashboardButton>
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false)
          setDetailsInternId(null)
        }}
        title={t('dashboard.operational.interns.modalTitle')}
      >
        {detailsLoading ? (
          <Skeleton height="240px" />
        ) : detailsError ? (
          <ErrorState
            message={detailsError}
            onRetry={() => {
              if (detailsInternId) {
                void openInternDetails(detailsInternId)
              }
            }}
          />
        ) : selectedIntern ? (
          <div className="admin-modal-details-grid">
            <div>
              <h3>{t('dashboard.operational.interns.detail.name')}</h3>
              <p>{selectedIntern.fullName}</p>
            </div>
            <div>
              <h3>{t('dashboard.operational.interns.detail.email')}</h3>
              <p>{selectedIntern.email}</p>
            </div>
            <div>
              <h3>{t('dashboard.operational.interns.detail.accountStatus')}</h3>
              <p>{selectedIntern.accountStatus}</p>
            </div>
            <div>
              <h3>{t('dashboard.operational.interns.detail.verificationStatus')}</h3>
              <p>{selectedIntern.verificationStatus}</p>
            </div>
            <div>
              <h3>{t('dashboard.operational.interns.detail.startDate')}</h3>
              <p>{selectedIntern.startDate ? new Date(selectedIntern.startDate).toLocaleDateString() : '-'}</p>
            </div>
            <div>
              <h3>{t('dashboard.operational.interns.detail.endDate')}</h3>
              <p>{selectedIntern.endDate ? new Date(selectedIntern.endDate).toLocaleDateString() : '-'}</p>
            </div>
            <div className="admin-modal-span-all">
              <h3>{t('dashboard.operational.interns.detail.cv')}</h3>
              {selectedIntern.cvFileUrl ? (
                <button
                  type="button"
                  className="admin-link-button"
                  onClick={() => {
                    const cvUrl = `${apiBaseUrl}/api/interns/${selectedIntern.id}/cv`
                    window.open(cvUrl, '_blank', 'noopener,noreferrer')
                  }}
                >
                  Open CV file
                </button>
              ) : (
                <p>{t('dashboard.operational.interns.noCv')}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="dash-empty">
            <h3 className="dash-empty-title">{t('dashboard.operational.interns.noDetails')}</h3>
          </div>
        )}
      </Modal>
    </section>
  )
}

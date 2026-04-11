import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { DashboardButton } from '../../components/DashboardButton'
import { ErrorState } from '../../components/ErrorState'
import { Modal } from '../../components/Modal'
import { Skeleton } from '../../components/Skeleton'
import { useDashboardApi } from '../../hooks/useDashboardApi'
import type { DashboardUser, DashboardUserApi, EvaluationApi, EvaluationRecord, PagedResponse } from '../types/operations'
import { toDashboardErrorMessage } from '../utils/errorMessage'
import { mapEvaluationApi, mapUserApi } from '../utils/operations'
import styles from './OperationalEvaluationsSection.module.css'

export function OperationalEvaluationsSection() {
  const { t } = useI18n()
  const api = useDashboardApi()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [evaluations, setEvaluations] = useState<EvaluationRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  const [typeFilter, setTypeFilter] = useState('')
  const [supervisorFilter, setSupervisorFilter] = useState('')
  const [internFilter, setInternFilter] = useState('')

  const [supervisorOptions, setSupervisorOptions] = useState<DashboardUser[]>([])
  const [internOptions, setInternOptions] = useState<DashboardUser[]>([])

  const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationRecord | null>(null)

  const loadUsers = useCallback(async () => {
    const [supervisorPayload, internPayload] = await Promise.all([
      api.get<PagedResponse<DashboardUserApi>>('/api/users?role=supervisor&page=1&limit=200'),
      api.get<PagedResponse<DashboardUserApi>>('/api/users?role=intern&page=1&limit=200'),
    ])

    setSupervisorOptions(
      (supervisorPayload.data ?? [])
        .map(mapUserApi)
        .filter((item): item is DashboardUser => item !== null),
    )

    setInternOptions(
      (internPayload.data ?? [])
        .map(mapUserApi)
        .filter((item): item is DashboardUser => item !== null),
    )
  }, [api])

  const loadEvaluations = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', String(pageSize))

      if (typeFilter) {
        params.set('type', typeFilter)
      }

      if (supervisorFilter) {
        params.set('supervisorId', supervisorFilter)
      }

      if (internFilter) {
        params.set('internId', internFilter)
      }

      const payload = await api.get<PagedResponse<EvaluationApi>>(`/api/evaluations?${params.toString()}`)
      const mappedEvaluations = (payload.data ?? [])
        .map(mapEvaluationApi)
        .filter((item): item is EvaluationRecord => item !== null)

      setEvaluations(mappedEvaluations)
      setTotal(payload.total ?? mappedEvaluations.length)
    } catch (requestError) {
      setError(toDashboardErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [api, internFilter, page, pageSize, supervisorFilter, typeFilter])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  useEffect(() => {
    void loadEvaluations()
  }, [loadEvaluations])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / pageSize))
  }, [pageSize, total])

  return (
    <section className={`${styles.root} super-admin-section admin-view-section`} id="section-evaluations">
      <header className="section-header-row">
        <div className="section-header-text">
          <h2 className="section-title">{t('dashboard.operational.evaluations.title')}</h2>
          <p className="section-subtitle">Read-only list of platform evaluations with drill-down details.</p>
        </div>
      </header>

      <div className="admin-toolbar admin-toolbar-grid-three">
        <select className="dash-input dash-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
          <option value="">{t('dashboard.operational.evaluations.allTypes')}</option>
          <option value="mid-term">mid-term</option>
          <option value="end">end</option>
        </select>

        <select
          className="dash-input dash-select"
          value={supervisorFilter}
          onChange={(event) => setSupervisorFilter(event.target.value)}
        >
          <option value="">{t('dashboard.operational.evaluations.allSupervisors')}</option>
          {supervisorOptions.map((user) => (
            <option key={user.id} value={user.id}>{user.fullName}</option>
          ))}
        </select>

        <select className="dash-input dash-select" value={internFilter} onChange={(event) => setInternFilter(event.target.value)}>
          <option value="">{t('dashboard.operational.evaluations.allInterns')}</option>
          {internOptions.map((user) => (
            <option key={user.id} value={user.id}>{user.fullName}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="skeleton-block">
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadEvaluations()} />
      ) : evaluations.length === 0 ? (
        <div className="dash-empty">
          <h3 className="dash-empty-title">{t('dashboard.operational.evaluations.empty')}</h3>
          <p className="dash-empty-description">{t('dashboard.operational.evaluations.emptyDesc')}</p>
        </div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="dash-table super-admin-table">
              <thead>
                <tr>
                  <th>{t('dashboard.operational.evaluations.table.intern')}</th>
                  <th>{t('dashboard.operational.evaluations.table.supervisor')}</th>
                  <th>{t('dashboard.operational.evaluations.table.type')}</th>
                  <th>{t('dashboard.operational.evaluations.table.status')}</th>
                  <th>{t('dashboard.operational.evaluations.table.submitted')}</th>
                  <th>{t('dashboard.operational.evaluations.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {evaluations.map((evaluation) => (
                  <tr key={evaluation.id}>
                    <td>{evaluation.internName}</td>
                    <td>{evaluation.supervisorName}</td>
                    <td>{evaluation.type}</td>
                    <td>{evaluation.status}</td>
                    <td>{evaluation.submittedAt ? new Date(evaluation.submittedAt).toLocaleString() : '-'}</td>
                    <td>
                      <button
                        className="dash-btn dash-btn-secondary dash-btn-sm"
                        onClick={() => setSelectedEvaluation(evaluation)}
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
              <DashboardButton
                variant="secondary"
                size="sm"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1}
              >
                Previous
              </DashboardButton>
              <span className="pagination-info">{t('dashboard.table.page')} {page} {t('dashboard.table.of')} {totalPages}</span>
              <DashboardButton
                variant="secondary"
                size="sm"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
              >
                Next
              </DashboardButton>
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={Boolean(selectedEvaluation)}
        onClose={() => setSelectedEvaluation(null)}
        title={selectedEvaluation ? `Evaluation - ${selectedEvaluation.internName}` : 'Evaluation Details'}
      >
        {selectedEvaluation ? (
          <div className="admin-modal-details-grid">
            <div>
              <h3>{t('dashboard.operational.evaluations.detail.intern')}</h3>
              <p>{selectedEvaluation.internName}</p>
            </div>
            <div>
              <h3>{t('dashboard.operational.evaluations.detail.supervisor')}</h3>
              <p>{selectedEvaluation.supervisorName}</p>
            </div>
            <div>
              <h3>{t('dashboard.operational.evaluations.detail.type')}</h3>
              <p>{selectedEvaluation.type}</p>
            </div>
            <div>
              <h3>{t('dashboard.operational.evaluations.detail.status')}</h3>
              <p>{selectedEvaluation.status}</p>
            </div>
            <div>
              <h3>{t('dashboard.operational.evaluations.detail.technical')}</h3>
              <p>{selectedEvaluation.technical}</p>
            </div>
            <div>
              <h3>{t('dashboard.operational.evaluations.detail.autonomy')}</h3>
              <p>{selectedEvaluation.autonomy}</p>
            </div>
            <div>
              <h3>{t('dashboard.operational.evaluations.detail.communication')}</h3>
              <p>{selectedEvaluation.communication}</p>
            </div>
            <div>
              <h3>{t('dashboard.operational.evaluations.detail.deadlineRespect')}</h3>
              <p>{selectedEvaluation.deadlineRespect}</p>
            </div>
            <div>
              <h3>{t('dashboard.operational.evaluations.detail.deliverableQuality')}</h3>
              <p>{selectedEvaluation.deliverableQuality}</p>
            </div>
            <div className="admin-modal-span-all">
              <h3>{t('dashboard.operational.evaluations.detail.comments')}</h3>
              <p>{selectedEvaluation.comments || '-'}</p>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  )
}

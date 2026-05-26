import { useCallback, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../../../locales/I18nContext'
import { getCsrfCookieToken } from '../../../../lib/auth'
import { apiFetch } from '../../../../lib/apiClient'
import { DashboardButton } from '../../components/DashboardButton'
import { ErrorState } from '../../components/ErrorState'
import { Modal } from '../../components/Modal'
import { Skeleton } from '../../components/Skeleton'
import { StatusBadge } from '../../components/StatusBadge'
import { useDashboardApi } from '../../hooks/useDashboardApi'
import { toDashboardErrorMessage } from '../../shared/utils/errorMessage'
import { toDateInputValue } from '../../shared/utils/operations'
import { asNonEmptyString } from './utils'
import type { Intern } from './types'

interface InternDetailsModalProps {
  isOpen: boolean
  intern: Intern | null
  onClose: () => void
  getInitials: (name: string) => string
}

interface InternDetailsPayload {
  id?: string
  firstName?: string
  lastName?: string
  fullName?: string
  email?: string
  status?: string
  accountStatus?: string
  verificationStatus?: string
  cvFileUrl?: string | null
  startDate?: string | null
  endDate?: string | null
  phone?: string | null
  school?: string | null
  specialty?: string | null
  level?: string | null
  skills?: InternSkillPayload[]
  currentInternship?: InternCurrentInternshipPayload | null
}

interface InternSkillPayload {
  id?: string
  name?: string
}

interface InternCurrentInternshipSupervisorPayload {
  id?: string
  name?: string
  email?: string
}

interface InternCurrentInternshipMissionPayload {
  id?: string
  title?: string
}

interface InternCurrentInternshipPayload {
  id?: string
  type?: string | null
  department?: string | null
  startDate?: string | null
  endDate?: string | null
  status?: string
  supervisor?: InternCurrentInternshipSupervisorPayload | null
  mission?: InternCurrentInternshipMissionPayload | null
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

function toStatusTone(rawValue: string): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
  const normalized = rawValue.trim().toLowerCase().replace(/[_-]/g, ' ')

  if (!normalized || normalized === 'unknown') return 'neutral'
  if (normalized.includes('pending') || normalized.includes('incomplete')) return 'warning'
  if (normalized.includes('active') || normalized.includes('verified') || normalized.includes('approved')) return 'success'
  if (normalized.includes('rejected') || normalized.includes('denied')) return 'danger'

  return 'info'
}

async function readResponseMessage(response: Response): Promise<string | null> {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    try {
      const payload = await response.json() as Record<string, unknown>
      const message = typeof payload.message === 'string' ? payload.message.trim() : ''
      if (message) {
        return message
      }

      const title = typeof payload.title === 'string' ? payload.title.trim() : ''
      if (title) {
        return title
      }
    } catch {
      return null
    }
  }

  try {
    const responseText = await response.text()
    return responseText.trim() || null
  } catch {
    return null
  }
}

export function InternDetailsModal({
  isOpen,
  intern,
  onClose,
  getInitials,
}: InternDetailsModalProps) {
  const { t } = useI18n()
  const api = useDashboardApi()

  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)
  const [internDetails, setInternDetails] = useState<InternDetailsPayload | null>(null)

  const [cvLoading, setCvLoading] = useState(false)
  const [cvError, setCvError] = useState<string | null>(null)

  const targetInternId = asNonEmptyString(intern?.id)

  const loadInternDetails = useCallback(async (internId: string) => {
    setDetailsLoading(true)
    setDetailsError(null)

    try {
      const internPayload = await api.get<InternDetailsPayload>(`/api/interns/${internId}`)

      setInternDetails(internPayload)
    } catch (error) {
      setDetailsError(toDashboardErrorMessage(error))
      setInternDetails(null)
    } finally {
      setDetailsLoading(false)
    }
  }, [api])

  useEffect(() => {
    if (!isOpen || !targetInternId) {
      return
    }

    void loadInternDetails(targetInternId)
  }, [isOpen, loadInternDetails, targetInternId])

  useEffect(() => {
    if (!isOpen) {
      setCvError(null)
    }
  }, [isOpen])

  const internSkillItems = useMemo(() => {
    return (internDetails?.skills ?? [])
      .map((skill) => ({
        id: asNonEmptyString(skill.id),
        name: asNonEmptyString(skill.name),
      }))
      .filter((skill) => skill.id.length > 0 && skill.name.length > 0)
  }, [internDetails?.skills])

  const hasCv = useMemo(() => {
    return Boolean(asNonEmptyString(internDetails?.cvFileUrl) || asNonEmptyString(intern?.cvFileUrl))
  }, [internDetails?.cvFileUrl, intern?.cvFileUrl])

  const handleViewCv = async () => {
    if (!targetInternId) {
      return
    }

    setCvLoading(true)
    setCvError(null)

    try {
      const csrfToken = getCsrfCookieToken()
      const headers: Record<string, string> = {}
      if (csrfToken) {
        headers['X-CSRF-Token'] = csrfToken
      }

      const response = await apiFetch(`/api/interns/${targetInternId}/cv`, {
        method: 'GET',
        headers,
        omitJsonAcceptHeader: true,
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('No CV on file for this intern')
        }

        if (response.status === 403) {
          throw new Error('You do not have permission to view this CV')
        }

        const message = await readResponseMessage(response)
        throw new Error(message || 'Unable to open this CV.')
      }

      const contentType = response.headers.get('content-type') ?? ''
      if (contentType.includes('application/json') || contentType.includes('text/plain')) {
        const rawPayload = (await response.text()).trim()

        try {
          const jsonPayload = JSON.parse(rawPayload) as Record<string, unknown>
          const rawUrl = typeof jsonPayload.url === 'string' ? jsonPayload.url.trim() : ''
          if (rawUrl) {
            window.open(rawUrl, '_blank', 'noopener,noreferrer')
            return
          }
        } catch {
          const normalizedUrl = rawPayload.replace(/^"|"$/g, '')
          if (/^https?:\/\//i.test(normalizedUrl) || normalizedUrl.startsWith('/')) {
            window.open(normalizedUrl, '_blank', 'noopener,noreferrer')
            return
          }
        }
      }

      const cvBlob = await response.blob()
      const blobUrl = URL.createObjectURL(cvBlob)
      window.open(blobUrl, '_blank', 'noopener,noreferrer')
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
    } catch (error) {
      if (error instanceof Error && error.message.trim()) {
        setCvError(error.message)
      } else {
        setCvError('Unable to open this CV.')
      }

      if (!(error instanceof Error && (error.message.includes('No CV') || error.message.includes('permission')))) {
        // Keep diagnostics for unexpected failures without exposing internal details to users.
        console.error('Failed to open intern CV', error)
      }
    } finally {
      setCvLoading(false)
    }
  }

  const internDisplayName = asNonEmptyString(internDetails?.fullName) || asNonEmptyString(intern?.name)
  const internshipStatusValue = asNonEmptyString(internDetails?.currentInternship?.status)
  const accountStatusValue = asNonEmptyString(internDetails?.accountStatus) || asNonEmptyString(intern?.accountStatus)
  const verificationStatusValue = asNonEmptyString(internDetails?.verificationStatus) || asNonEmptyString(intern?.verificationStatus) || 'Unknown'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={internDisplayName || t('dashboard.manager.internDetails.title')} hideHeader>
      {!intern ? null : detailsLoading ? (
        <Skeleton height="320px" />
      ) : detailsError ? (
        <ErrorState
          message={detailsError}
          onRetry={() => {
            if (targetInternId) {
              void loadInternDetails(targetInternId)
            }
          }}
        />
      ) : (
        <div className="intern-modal-content">
          <div className="intern-modal-header">
            <span className="intern-modal-avatar" aria-hidden="true">{getInitials(internDisplayName || intern.name)}</span>
            <div className="intern-modal-info">
              <h3>{internDisplayName || '-'}</h3>
              <p className="intern-modal-email">{asNonEmptyString(internDetails?.email) || intern.email || '-'}</p>
            </div>
            <button
              type="button"
              className="modal-close-button"
              onClick={onClose}
              aria-label={t('dashboard.form.close')}
            >
              ✕
            </button>
          </div>

          <div className="intern-modal-block">
            <h4 className="intern-modal-section-title">{t('dashboard.manager.internDetails.section.personalInfo')}</h4>
            <div className="admin-modal-details-grid">
              <div>
                <h3>{t('dashboard.manager.internDetails.label.phone')}</h3>
                <p>{asNonEmptyString(internDetails?.phone) || '—'}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.school')}</h3>
                <p>{asNonEmptyString(internDetails?.school) || '—'}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.specialty')}</h3>
                <p>{asNonEmptyString(internDetails?.specialty) || '—'}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.level')}</h3>
                <p>{asNonEmptyString(internDetails?.level) || '—'}</p>
              </div>
            </div>
          </div>

          <div className="intern-modal-block">
            <h4 className="intern-modal-section-title">{t('dashboard.manager.internDetails.section.internshipInfo')}</h4>
            <div className="admin-modal-details-grid">
              <div>
                <h3>{t('dashboard.manager.internDetails.label.type')}</h3>
                <p>{asNonEmptyString(internDetails?.currentInternship?.type) || asNonEmptyString(intern?.internshipType) || '—'}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.department')}</h3>
                <p>{asNonEmptyString(internDetails?.currentInternship?.department) || intern.department || '—'}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.startDate')}</h3>
                <p>{toDateInputValue(asNonEmptyString(internDetails?.startDate) || asNonEmptyString(internDetails?.currentInternship?.startDate) || null) || '—'}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.endDate')}</h3>
                <p>{toDateInputValue(asNonEmptyString(internDetails?.endDate) || asNonEmptyString(internDetails?.currentInternship?.endDate) || null) || '—'}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.internshipStatus')}</h3>
                <p>{internshipStatusValue ? toDisplayLabel(internshipStatusValue) : '—'}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.accountStatus')}</h3>
                <StatusBadge
                  label={toDisplayLabel(accountStatusValue || 'Unknown')}
                  tone={toStatusTone(accountStatusValue || 'Unknown')}
                  size="sm"
                />
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.verificationStatus')}</h3>
                <StatusBadge
                  label={toDisplayLabel(verificationStatusValue)}
                  tone={toStatusTone(verificationStatusValue)}
                  size="sm"
                />
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.cv')}</h3>
                <DashboardButton
                  variant="ghost"
                  size="sm"
                  loading={cvLoading}
                  disabled={!hasCv || cvLoading}
                  title={!hasCv ? t('dashboard.manager.internDetails.noCvUploaded') : undefined}
                  onClick={() => void handleViewCv()}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  {t('dashboard.manager.internDetails.viewCv')}
                </DashboardButton>
              </div>
            </div>
          </div>

          <div className="intern-modal-block">
            <h4 className="intern-modal-section-title">{t('dashboard.manager.internDetails.section.skills')}</h4>
            {internSkillItems.length > 0 ? (
              <div className="intern-modal-chip-list" role="list" aria-label={t('dashboard.manager.internDetails.aria.selectedSkills')}>
                {internSkillItems.map((skill) => (
                  <span key={skill.id} role="listitem" className="dash-status-chip dash-status-chip-info dash-status-chip-sm">
                    {skill.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="intern-modal-muted">{t('dashboard.manager.internDetails.noSkills')}</p>
            )}
          </div>

          <div className="intern-modal-block">
            <h4 className="intern-modal-section-title">{t('dashboard.manager.internDetails.section.supervisorMission')}</h4>
            <div className="admin-modal-details-grid">
              <div>
                <h3>{t('dashboard.manager.internDetails.label.mission')}</h3>
                <p>{asNonEmptyString(internDetails?.currentInternship?.mission?.title) || t('dashboard.manager.internDetails.notAssigned')}</p>
              </div>
              <div>
                <h3>{t('dashboard.manager.internDetails.label.supervisor')}</h3>
                <p>{asNonEmptyString(internDetails?.currentInternship?.supervisor?.name) || t('dashboard.manager.internDetails.notAssigned')}</p>
              </div>
            </div>
          </div>

          <div className="intern-modal-actions">
            <DashboardButton variant="secondary" onClick={onClose}>
              {t('dashboard.manager.internDetails.close')}
            </DashboardButton>
          </div>

          {cvError && <p className="form-error">{cvError}</p>}
        </div>
      )}
    </Modal>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DashboardButton } from '../../components/DashboardButton'
import { ErrorState } from '../../components/ErrorState'
import { Skeleton } from '../../components/Skeleton'
import { useDashboardApi } from '../../hooks/useDashboardApi'
import { useI18n } from '@/locales/I18nContext'
import { toDashboardErrorMessage } from '../../shared/utils/errorMessage'
import styles from './SupervisorJournalReviewPage.module.css'

type JournalCriterion = 'Technical' | 'Autonomy' | 'Communication' | 'DeadlineRespect' | 'DeliverableQuality'

interface JournalComment {
  journalCommentId: number
  authorId: string
  content: string
  createdAt: string
}

interface JournalEvaluationLink {
  journalEvaluationLinkId: number
  criteria: JournalCriterion
  linkedByUserId: string
  createdAt: string
}

interface JournalEntryReview {
  id: string
  internId: string
  content: string
  isReviewed: boolean
  createdAt: string
  comments: JournalComment[]
  evaluationLinks: JournalEvaluationLink[]
}

type CriteriaByEntry = Record<string, JournalCriterion[]>
type CommentDraftByEntry = Record<string, string>

const criteriaOrder: JournalCriterion[] = [
  'Technical',
  'Autonomy',
  'Communication',
  'DeadlineRespect',
  'DeliverableQuality',
]

const criterionApiValue: Record<JournalCriterion, number> = {
  Technical: 0,
  Autonomy: 1,
  Communication: 2,
  DeadlineRespect: 3,
  DeliverableQuality: 4,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function toBooleanValue(value: unknown): boolean {
  return typeof value === 'boolean' ? value : false
}

function toNumberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function normalizeCriterionToken(rawValue: string): string {
  return rawValue.trim().toLowerCase().replace(/[\s_]+/g, '')
}

function parseCriterion(value: unknown): JournalCriterion | null {
  if (typeof value === 'number') {
    return criteriaOrder[value] ?? null
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = normalizeCriterionToken(value)

  if (normalized === 'technical') return 'Technical'
  if (normalized === 'autonomy') return 'Autonomy'
  if (normalized === 'communication') return 'Communication'
  if (normalized === 'deadlinerespect') return 'DeadlineRespect'
  if (normalized === 'deliverablequality') return 'DeliverableQuality'

  return null
}

function parseComment(value: unknown): JournalComment | null {
  if (!isRecord(value)) {
    return null
  }

  const journalCommentId = toNumberValue(value.journalCommentId || value.id)
  const authorId = toStringValue(value.authorId)

  if (journalCommentId <= 0) {
    return null
  }

  return {
    journalCommentId,
    authorId,
    content: toStringValue(value.content),
    createdAt: toStringValue(value.createdAt),
  }
}

function parseEvaluationLink(value: unknown): JournalEvaluationLink | null {
  if (!isRecord(value)) {
    return null
  }

  const journalEvaluationLinkId = toNumberValue(value.journalEvaluationLinkId || value.id)
  const criteria = parseCriterion(value.criteria)

  if (journalEvaluationLinkId <= 0 || !criteria) {
    return null
  }

  return {
    journalEvaluationLinkId,
    criteria,
    linkedByUserId: toStringValue(value.linkedByUserId),
    createdAt: toStringValue(value.createdAt),
  }
}

function parseEntry(value: unknown): JournalEntryReview | null {
  if (!isRecord(value)) {
    return null
  }

  const id = toStringValue(value.id)
  const internId = toStringValue(value.internId)
  if (!id || !internId) {
    return null
  }

  const comments = Array.isArray(value.comments)
    ? value.comments
      .map(parseComment)
      .filter((item): item is JournalComment => item !== null)
    : []

  const evaluationLinks = Array.isArray(value.evaluationLinks)
    ? value.evaluationLinks
      .map(parseEvaluationLink)
      .filter((item): item is JournalEvaluationLink => item !== null)
    : []

  return {
    id,
    internId,
    content: toStringValue(value.content),
    isReviewed: toBooleanValue(value.isReviewed),
    createdAt: toStringValue(value.createdAt),
    comments,
    evaluationLinks,
  }
}

function sortAndDeduplicateCriteria(criteria: JournalCriterion[]): JournalCriterion[] {
  return criteriaOrder.filter((criterion) => criteria.includes(criterion))
}

function toCriteriaByEntry(entries: JournalEntryReview[]): CriteriaByEntry {
  const next: CriteriaByEntry = {}

  for (const entry of entries) {
    next[entry.id] = sortAndDeduplicateCriteria(entry.evaluationLinks.map((link) => link.criteria))
  }

  return next
}

function areCriteriaEqual(left: JournalCriterion[], right: JournalCriterion[]): boolean {
  if (left.length !== right.length) {
    return false
  }

  return left.every((criterion, index) => criterion === right[index])
}

export function SupervisorJournalReviewPage() {
  const api = useDashboardApi()
  const navigate = useNavigate()
  const { internId } = useParams<{ internId?: string }>()
  const { t } = useI18n()

  const criterionLabel: Record<JournalCriterion, string> = {
    Technical: t('dashboard.supervisorJournalReview.criterion.technical'),
    Autonomy: t('dashboard.supervisorJournalReview.criterion.autonomy'),
    Communication: t('dashboard.supervisorJournalReview.criterion.communication'),
    DeadlineRespect: t('dashboard.supervisorJournalReview.criterion.deadlineRespect'),
    DeliverableQuality: t('dashboard.supervisorJournalReview.criterion.deliverableQuality'),
  }

  const [entries, setEntries] = useState<JournalEntryReview[]>([])
  const [criteriaByEntry, setCriteriaByEntry] = useState<CriteriaByEntry>({})
  const [commentDraftByEntry, setCommentDraftByEntry] = useState<CommentDraftByEntry>({})

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null)

  const loadEntries = useCallback(async () => {
    if (!internId) {
      setEntries([])
      setIsLoading(false)
      setError(t('dashboard.supervisorJournalReview.missingInternId'))
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const payload = await api.get<{ data?: unknown }>(`/api/supervisor/interns/${internId}/journal`)
      const normalizedEntries = Array.isArray(payload.data)
        ? payload.data.map(parseEntry).filter((item): item is JournalEntryReview => item !== null)
        : []

      setEntries(normalizedEntries)
      setCriteriaByEntry(toCriteriaByEntry(normalizedEntries))
      setCommentDraftByEntry((previous) => {
        const next: CommentDraftByEntry = {}

        for (const entry of normalizedEntries) {
          next[entry.id] = previous[entry.id] ?? ''
        }

        return next
      })
    } catch (requestError) {
      setEntries([])
      setError(toDashboardErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [api, internId, t])

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  const setCommentDraft = (entryId: string, value: string) => {
    setCommentDraftByEntry((previous) => ({
      ...previous,
      [entryId]: value,
    }))
  }

  const toggleCriterion = (entryId: string, criterion: JournalCriterion) => {
    setCriteriaByEntry((previous) => {
      const current = previous[entryId] ?? []
      const hasCriterion = current.includes(criterion)

      const nextSelection = hasCriterion
        ? current.filter((item) => item !== criterion)
        : [...current, criterion]

      return {
        ...previous,
        [entryId]: sortAndDeduplicateCriteria(nextSelection),
      }
    })
  }

  const addComment = async (entryId: string) => {
    const content = (commentDraftByEntry[entryId] ?? '').trim()

    if (!content) {
      setActionError(t('dashboard.supervisorJournalReview.commentContentRequired'))
      return
    }

    setBusyEntryId(entryId)
    setActionError(null)

    try {
      await api.post(`/api/supervisor/journal-entries/${entryId}/comments`, { content })
      setCommentDraft(entryId, '')
      await loadEntries()
    } catch (requestError) {
      setActionError(toDashboardErrorMessage(requestError))
    } finally {
      setBusyEntryId(null)
    }
  }

  const deleteComment = async (entryId: string, commentId: number) => {
    if (!window.confirm(t('dashboard.supervisorJournalReview.deleteCommentConfirm'))) {
      return
    }

    setBusyEntryId(entryId)
    setActionError(null)

    try {
      await api.del(`/api/supervisor/journal-entries/${entryId}/comments/${commentId}`)
      await loadEntries()
    } catch (requestError) {
      setActionError(toDashboardErrorMessage(requestError))
    } finally {
      setBusyEntryId(null)
    }
  }

  const saveCriteriaLinks = async (entryId: string) => {
    const selectedCriteria = criteriaByEntry[entryId] ?? []

    setBusyEntryId(entryId)
    setActionError(null)

    try {
      await api.post(`/api/supervisor/journal-entries/${entryId}/evaluation-links`, {
        criteria: selectedCriteria.map((criterion) => criterionApiValue[criterion]),
      })

      await loadEntries()
    } catch (requestError) {
      setActionError(toDashboardErrorMessage(requestError))
    } finally {
      setBusyEntryId(null)
    }
  }

  const markReviewed = async (entryId: string) => {
    setBusyEntryId(entryId)
    setActionError(null)

    try {
      await api.patch(`/api/supervisor/journal-entries/${entryId}/mark-reviewed`, {})
      await loadEntries()
    } catch (requestError) {
      setActionError(toDashboardErrorMessage(requestError))
    } finally {
      setBusyEntryId(null)
    }
  }

  const criteriaDirtyByEntry = useMemo(() => {
    const next: Record<string, boolean> = {}

    for (const entry of entries) {
      const selected = sortAndDeduplicateCriteria(criteriaByEntry[entry.id] ?? [])
      const current = sortAndDeduplicateCriteria(entry.evaluationLinks.map((link) => link.criteria))
      next[entry.id] = !areCriteriaEqual(selected, current)
    }

    return next
  }, [criteriaByEntry, entries])

  if (isLoading) {
    return (
      <section className={styles.root}>
        <Skeleton height="72px" />
        <Skeleton height="220px" />
        <Skeleton height="220px" />
      </section>
    )
  }

  if (error) {
    return (
      <section className={styles.root}>
        <ErrorState message={error} onRetry={() => { void loadEntries() }} />
      </section>
    )
  }

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <div>
<h2 className={styles.title}>{t('dashboard.supervisorJournalReview.title')}</h2>
        <p className={styles.subtitle}>{t('dashboard.supervisorJournalReview.entryId')}: {internId}</p>
        </div>

        <div className={styles.headerActions}>
          <DashboardButton
            variant="secondary"
            size="sm"
            onClick={() => {
              navigate('/dashboard')
            }}
          >
            {t('dashboard.supervisorJournalReview.backToDashboard')}
          </DashboardButton>
          <DashboardButton variant="ghost" size="sm" onClick={() => { void loadEntries() }}>
            {t('dashboard.supervisorJournalReview.refresh')}
          </DashboardButton>
        </div>
      </header>

      {actionError && <p className={styles.errorText}>{actionError}</p>}

      {entries.length === 0 ? (
        <div className={styles.emptyState}>
<h3>{t('dashboard.supervisorJournalReview.noEntriesTitle')}</h3>
        <p>{t('dashboard.supervisorJournalReview.noEntriesDesc')}</p>
        </div>
      ) : (
        <div className={styles.entriesList}>
          {entries.map((entry) => {
            const selectedCriteria = criteriaByEntry[entry.id] ?? []
            const isBusy = busyEntryId === entry.id

            return (
              <article key={entry.id} className={styles.entryCard}>
                <header className={styles.entryHeader}>
                  <div>
                    <h3>{t('dashboard.supervisorJournalReview.entryFrom')} {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '-'}</h3>
                    <p className={styles.entryId}>{t('dashboard.supervisorJournalReview.entryId')}: {entry.id}</p>
                  </div>

                  <div className={styles.entryHeaderActions}>
                    <span className={`${styles.reviewBadge} ${entry.isReviewed ? styles.reviewed : styles.pending}`}>
                      {entry.isReviewed ? t('dashboard.supervisorJournalReview.reviewed') : t('dashboard.supervisorJournalReview.notReviewed')}
                    </span>
                    <DashboardButton
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        void markReviewed(entry.id)
                      }}
                      disabled={entry.isReviewed || isBusy}
                    >
                      {t('dashboard.supervisorJournalReview.markReviewed')}
                    </DashboardButton>
                  </div>
                </header>

                <p className={styles.entryContent}>{entry.content || '-'}</p>

                <section className={styles.block}>
                  <h4>{t('dashboard.supervisorJournalReview.evaluationCriteria')}</h4>
                  <div className={styles.criteriaGrid}>
                    {criteriaOrder.map((criterion) => (
                      <label key={criterion} className={styles.criteriaItem}>
                        <input
                          type="checkbox"
                          checked={selectedCriteria.includes(criterion)}
                          onChange={() => toggleCriterion(entry.id, criterion)}
                          disabled={isBusy}
                        />
                        <span>{criterionLabel[criterion]}</span>
                      </label>
                    ))}
                  </div>

                  <div className={styles.inlineActions}>
                    <DashboardButton
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        void saveCriteriaLinks(entry.id)
                      }}
                      disabled={!criteriaDirtyByEntry[entry.id] || isBusy}
                      loading={isBusy}
                    >
                      {t('dashboard.supervisorJournalReview.saveCriteriaLinks')}
                    </DashboardButton>
                  </div>
                </section>

                <section className={styles.block}>
                  <h4>{t('dashboard.supervisorJournalReview.supervisorComments')}</h4>

                  {entry.comments.length === 0 ? (
                    <p className={styles.smallMuted}>{t('dashboard.supervisorJournalReview.noComments')}</p>
                  ) : (
                    <ul className={styles.commentList}>
                      {entry.comments.map((comment) => (
                        <li key={comment.journalCommentId} className={styles.commentItem}>
                          <div>
                            <p className={styles.commentMeta}>
                              {comment.createdAt ? new Date(comment.createdAt).toLocaleString() : '-'}
                            </p>
                            <p className={styles.commentContent}>{comment.content}</p>
                          </div>
                          <DashboardButton
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              void deleteComment(entry.id, comment.journalCommentId)
                            }}
                            disabled={isBusy}
                          >
                            {t('dashboard.supervisorJournalReview.deleteComment')}
                          </DashboardButton>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className={styles.commentComposer}>
                    <textarea
                      value={commentDraftByEntry[entry.id] ?? ''}
                      onChange={(event) => setCommentDraft(entry.id, event.target.value)}
                      placeholder={t('dashboard.supervisorJournalReview.writeCommentPlaceholder')}
                      rows={3}
                      disabled={isBusy}
                    />
                    <DashboardButton
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        void addComment(entry.id)
                      }}
                      disabled={isBusy}
                      loading={isBusy}
                    >
                      {t('dashboard.supervisorJournalReview.addComment')}
                    </DashboardButton>
                  </div>
                </section>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

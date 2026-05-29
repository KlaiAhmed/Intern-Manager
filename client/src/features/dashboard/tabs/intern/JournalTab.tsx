import { useState, type FormEvent } from 'react'
import { DashboardButton } from '../../components/DashboardButton'
import { useInternJournal } from '../../hooks/intern/useInternJournal'
import { toErrorMessage } from '../../shared/utils/errorMessage'
import type { TranslateFn } from '../../types/internDashboard'
import { InternTabEmpty, InternTabError, InternTabLoading } from './InternTabStates'

interface JournalTabProps {
  isReadOnly: boolean
  t: TranslateFn
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function JournalTab({ isReadOnly, t }: JournalTabProps) {
  const state = useInternJournal({ limit: 20 })
  const [content, setContent] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!isReadOnly) {
      const normalizedContent = content.trim()
      if (!normalizedContent) {
        setFormError(t('dashboard.form.required'))
        return
      }

      setFormError(null)
      void state.addEntry({ content: normalizedContent })
        .then(() => setContent(''))
        .catch((error) => setFormError(toErrorMessage(error, t('dashboard.intern.journal.saveFailed'))))
    }
  }

  if (state.isLoading) {
    return <InternTabLoading label={t('dashboard.intern.tabs.loading')} />
  }

  const loadError = state.journalQuery.error

  if (loadError) {
    return (
      <InternTabError
        title={t('dashboard.intern.tabs.errorTitle')}
        message={toErrorMessage(loadError, t('dashboard.intern.tabs.errorMessage'))}
        retryLabel={t('dashboard.intern.error.retry')}
        onRetry={state.refetch}
      />
    )
  }

  return (
    <div className="intern-tab-stack">
      <section className="intern-panel">
        <div className="intern-section-header">
          <div>
            <p className="intern-eyebrow">{t('dashboard.intern.tabs.journal')}</p>
            <h2>{t('dashboard.intern.journal.newEntry')}</h2>
          </div>
        </div>

        <form className="intern-journal-form" onSubmit={handleSubmit}>
          <label className="intern-form-field">
            <span>{t('dashboard.form.description')}</span>
            <textarea
              rows={5}
              value={content}
              disabled={isReadOnly}
              onChange={(event) => setContent(event.target.value)}
            />
          </label>
          {isReadOnly && <p className="intern-muted">{t('dashboard.intern.journal.readOnly')}</p>}
          {formError && <p className="intern-inline-error">{formError}</p>}
          <DashboardButton type="submit" variant="primary" size="sm" loading={state.createEntryMutation.isPending} disabled={isReadOnly}>
            {t('dashboard.intern.journal.addEntry')}
          </DashboardButton>
        </form>
      </section>

      <section className="intern-panel">
        <div className="intern-section-header">
          <h2>{t('dashboard.intern.journal.entries')}</h2>
        </div>

        {state.entries.length === 0 ? (
          <InternTabEmpty title={t('dashboard.intern.journal.emptyTitle')} message={t('dashboard.intern.journal.empty')} />
        ) : (
          <ol className="intern-timeline-list">
            {state.entries.map((entry) => (
              <li key={entry.id}>
                <time>{formatDate(entry.createdAt)}</time>
                <p>{entry.content}</p>
                {entry.isReviewed && <span className="intern-status-pill">{t('dashboard.intern.journal.reviewed')}</span>}
                {(entry.comments?.length ?? 0) > 0 && (
                  <small>{t('dashboard.intern.journal.commentCount', { count: entry.comments?.length ?? 0 })}</small>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { unstable_usePrompt, useBeforeUnload } from 'react-router-dom'
import { DashboardButton } from '../../components/DashboardButton'
import { ErrorState } from '../../components/ErrorState'
import { Skeleton } from '../../components/Skeleton'
import { useDashboardApi } from '../../hooks/useDashboardApi'
import { toDashboardErrorMessage } from '../../shared/utils/errorMessage'
import {
  defaultMissionCardConfig,
  parseMissionCardConfig,
  type DashboardCard,
  type MissionCardConfig,
} from '../../types/missionFeatureFlags'
import styles from './MissionFeatureFlagsSection.module.css'

interface MissionFeatureFlagsSectionProps {
  missionId: string
  onBack: () => void
}

interface MissionFeatureFlagHistoryItem {
  changedBy: string
  changedAt: string
  card: string
  field: string
  oldValue: string | null
  newValue: string | null
}

type RequirementTextByCard = Record<DashboardCard, string>
type RequirementErrorByCard = Partial<Record<DashboardCard, string>>

const dashboardCards: DashboardCard[] = [
  'missionOverview',
  'quickStats',
  'tasks',
  'deliverables',
  'evaluation',
  'journal',
  'meeting',
]

const cardLabels: Record<DashboardCard, string> = {
  missionOverview: 'Mission Overview',
  quickStats: 'Quick Stats',
  tasks: 'Tasks',
  deliverables: 'Deliverables',
  evaluation: 'Evaluation',
  journal: 'Journal',
  meeting: 'Meeting',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function formatRequirementConfig(value: Record<string, unknown> | null | undefined): string {
  if (!value || Object.keys(value).length === 0) {
    return ''
  }

  return JSON.stringify(value, null, 2)
}

function toRequirementText(config: MissionCardConfig): RequirementTextByCard {
  return {
    missionOverview: formatRequirementConfig(config.missionOverview.requirementConfig),
    quickStats: formatRequirementConfig(config.quickStats.requirementConfig),
    tasks: formatRequirementConfig(config.tasks.requirementConfig),
    deliverables: formatRequirementConfig(config.deliverables.requirementConfig),
    evaluation: formatRequirementConfig(config.evaluation.requirementConfig),
    journal: formatRequirementConfig(config.journal.requirementConfig),
    meeting: formatRequirementConfig(config.meeting.requirementConfig),
  }
}

function parseHistoryItems(payload: unknown): MissionFeatureFlagHistoryItem[] {
  if (!Array.isArray(payload)) {
    return []
  }

  return payload
    .map((item) => {
      if (!isRecord(item)) {
        return null
      }

      return {
        changedBy: asString(item.changedBy) || 'Unknown',
        changedAt: asString(item.changedAt),
        card: asString(item.card) || '-',
        field: asString(item.field) || '-',
        oldValue: asNullableString(item.oldValue),
        newValue: asNullableString(item.newValue),
      }
    })
    .filter((item): item is MissionFeatureFlagHistoryItem => item !== null)
}

function normalizeConfig(payload: unknown): MissionCardConfig {
  return parseMissionCardConfig(payload) ?? defaultMissionCardConfig()
}

export function MissionFeatureFlagsSection({ missionId, onBack }: MissionFeatureFlagsSectionProps) {
  const api = useDashboardApi()

  const [savedConfig, setSavedConfig] = useState<MissionCardConfig>(defaultMissionCardConfig)
  const [draftConfig, setDraftConfig] = useState<MissionCardConfig>(defaultMissionCardConfig)
  const [requirementText, setRequirementText] = useState<RequirementTextByCard>(
    toRequirementText(defaultMissionCardConfig()),
  )
  const [requirementErrors, setRequirementErrors] = useState<RequirementErrorByCard>({})

  const [historyItems, setHistoryItems] = useState<MissionFeatureFlagHistoryItem[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isHistoryLoading, setIsHistoryLoading] = useState(true)

  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const isDirty = useMemo(() => {
    return JSON.stringify(savedConfig) !== JSON.stringify(draftConfig)
  }, [draftConfig, savedConfig])

  const hasRequirementErrors = useMemo(() => {
    return Object.values(requirementErrors).some((value) => Boolean(value))
  }, [requirementErrors])

  useBeforeUnload(
    useCallback((event) => {
      if (!isDirty) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }, [isDirty]),
    { capture: true },
  )

  unstable_usePrompt({
    when: isDirty,
    message: 'You have unsaved mission feature flag changes. Leave this page anyway?',
  })

  const loadConfig = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)

    try {
      const payload = await api.get<unknown>(`/api/missions/${missionId}/feature-flags`)
      const normalizedConfig = normalizeConfig(payload)

      setSavedConfig(normalizedConfig)
      setDraftConfig(normalizedConfig)
      setRequirementText(toRequirementText(normalizedConfig))
      setRequirementErrors({})
    } catch (requestError) {
      setLoadError(toDashboardErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [api, missionId])

  const loadHistory = useCallback(async () => {
    setIsHistoryLoading(true)
    setHistoryError(null)

    try {
      const payload = await api.get<{ data?: unknown }>(`/api/missions/${missionId}/feature-flags/history`)
      setHistoryItems(parseHistoryItems(payload.data))
    } catch (requestError) {
      setHistoryError(toDashboardErrorMessage(requestError))
      setHistoryItems([])
    } finally {
      setIsHistoryLoading(false)
    }
  }, [api, missionId])

  useEffect(() => {
    void loadConfig()
    void loadHistory()
  }, [loadConfig, loadHistory])

  const updateCardFlag = (card: DashboardCard, key: 'isVisible' | 'isInteractive', value: boolean) => {
    setDraftConfig((previous) => ({
      ...previous,
      [card]: {
        ...previous[card],
        [key]: value,
      },
    }))
  }

  const setRequirementError = (card: DashboardCard, message: string | null) => {
    setRequirementErrors((previous) => {
      const next = { ...previous }

      if (!message) {
        delete next[card]
        return next
      }

      next[card] = message
      return next
    })
  }

  const updateRequirementConfig = (card: DashboardCard, rawValue: string) => {
    setRequirementText((previous) => ({
      ...previous,
      [card]: rawValue,
    }))

    const trimmed = rawValue.trim()

    if (!trimmed) {
      setRequirementError(card, null)
      setDraftConfig((previous) => ({
        ...previous,
        [card]: {
          ...previous[card],
          requirementConfig: null,
        },
      }))
      return
    }

    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (!isRecord(parsed)) {
        setRequirementError(card, 'Requirement config must be a JSON object.')
        return
      }

      setRequirementError(card, null)
      setDraftConfig((previous) => ({
        ...previous,
        [card]: {
          ...previous[card],
          requirementConfig: parsed,
        },
      }))
    } catch {
      setRequirementError(card, 'Invalid JSON format.')
    }
  }

  const resetDraft = () => {
    setDraftConfig(savedConfig)
    setRequirementText(toRequirementText(savedConfig))
    setRequirementErrors({})
    setSaveError(null)
  }

  const saveConfig = async () => {
    if (hasRequirementErrors) {
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      const payload = await api.put<unknown>(`/api/missions/${missionId}/feature-flags`, draftConfig)
      const normalizedConfig = normalizeConfig(payload)

      setSavedConfig(normalizedConfig)
      setDraftConfig(normalizedConfig)
      setRequirementText(toRequirementText(normalizedConfig))
      setRequirementErrors({})

      await loadHistory()
    } catch (requestError) {
      setSaveError(toDashboardErrorMessage(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <section className={styles.root}>
        <Skeleton height="72px" />
        <Skeleton height="220px" />
        <Skeleton height="220px" />
      </section>
    )
  }

  if (loadError) {
    return (
      <section className={styles.root}>
        <ErrorState message={loadError} onRetry={() => { void loadConfig() }} />
      </section>
    )
  }

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Mission Feature Controls</h2>
          <p className={styles.subtitle}>Mission ID: {missionId}</p>
          {isDirty && <p className={styles.dirtyBadge}>Unsaved changes</p>}
        </div>

        <div className={styles.headerActions}>
          <DashboardButton variant="secondary" size="sm" onClick={onBack}>
            Back to Internships
          </DashboardButton>
          <DashboardButton variant="ghost" size="sm" onClick={() => { void loadHistory() }}>
            Refresh History
          </DashboardButton>
          <DashboardButton variant="secondary" size="sm" onClick={resetDraft} disabled={!isDirty || isSaving}>
            Reset
          </DashboardButton>
          <DashboardButton
            variant="primary"
            size="sm"
            onClick={() => { void saveConfig() }}
            disabled={!isDirty || hasRequirementErrors || isSaving}
            loading={isSaving}
          >
            Save Changes
          </DashboardButton>
        </div>
      </header>

      {saveError && <p className={styles.errorText}>{saveError}</p>}

      <div className={styles.cardsGrid}>
        {dashboardCards.map((card) => {
          const cardConfig = draftConfig[card]

          return (
            <article key={card} className={styles.cardEditor}>
              <div className={styles.cardEditorHeader}>
                <h3>{cardLabels[card]}</h3>
                <span className={styles.cardToken}>{card}</span>
              </div>

              <div className={styles.toggleRow}>
                <label className={styles.toggleItem}>
                  <input
                    type="checkbox"
                    checked={cardConfig.isVisible}
                    onChange={(event) => updateCardFlag(card, 'isVisible', event.target.checked)}
                  />
                  <span>Visible</span>
                </label>

                <label className={styles.toggleItem}>
                  <input
                    type="checkbox"
                    checked={cardConfig.isInteractive}
                    onChange={(event) => updateCardFlag(card, 'isInteractive', event.target.checked)}
                  />
                  <span>Interactive</span>
                </label>
              </div>

              <div className={styles.requirementField}>
                <label htmlFor={`requirement-${card}`}>Requirement JSON</label>
                <textarea
                  id={`requirement-${card}`}
                  value={requirementText[card]}
                  onChange={(event) => updateRequirementConfig(card, event.target.value)}
                  placeholder="{}"
                  rows={6}
                />
                {requirementErrors[card] && <p className={styles.validationText}>{requirementErrors[card]}</p>}
              </div>
            </article>
          )
        })}
      </div>

      <section className={styles.historySection}>
        <div className={styles.historyHeader}>
          <h3>Recent Changes</h3>
        </div>

        {isHistoryLoading ? (
          <Skeleton height="200px" />
        ) : historyError ? (
          <ErrorState message={historyError} onRetry={() => { void loadHistory() }} />
        ) : historyItems.length === 0 ? (
          <p className={styles.emptyText}>No feature-flag history available yet.</p>
        ) : (
          <div className={styles.historyTableWrapper}>
            <table className={styles.historyTable}>
              <thead>
                <tr>
                  <th>Changed At</th>
                  <th>Changed By</th>
                  <th>Card</th>
                  <th>Field</th>
                  <th>Old Value</th>
                  <th>New Value</th>
                </tr>
              </thead>
              <tbody>
                {historyItems.map((item, index) => (
                  <tr key={`${item.changedAt}-${item.card}-${item.field}-${index}`}>
                    <td>{item.changedAt ? new Date(item.changedAt).toLocaleString() : '-'}</td>
                    <td>{item.changedBy}</td>
                    <td>{item.card || '-'}</td>
                    <td>{item.field || '-'}</td>
                    <td>
                      <pre className={styles.historyValue}>{item.oldValue ?? 'null'}</pre>
                    </td>
                    <td>
                      <pre className={styles.historyValue}>{item.newValue ?? 'null'}</pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}

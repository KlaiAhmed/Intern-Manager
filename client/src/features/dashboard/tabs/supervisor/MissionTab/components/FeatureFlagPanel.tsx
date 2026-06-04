import { useState } from 'react'

import { StatusBadge } from '@/features/dashboard/components/StatusBadge'
import type { ToastTone } from '@/features/dashboard/components/Toast/useToast'
import type { DashboardCard, MissionCardConfig } from '@/features/dashboard/types/missionFeatureFlags'
import { useI18n } from '@/locales/I18nContext'

interface FeatureFlagPanelProps {
  featureFlags: MissionCardConfig | null
  updateFeatureFlags: (config: MissionCardConfig) => Promise<void>
  showToast: (message: string, tone: ToastTone) => void
}

const cardKeys: DashboardCard[] = [
  'missionOverview',
  'quickStats',
  'tasks',
  'deliverables',
  'evaluation',
  'journal',
  'meeting',
]

function getCardLabelKey(card: DashboardCard): string {
  return `dashboard.supervisor.featureFlags.card.${card}`
}

export function FeatureFlagPanel({
  featureFlags,
  updateFeatureFlags,
  showToast,
}: FeatureFlagPanelProps) {
  const { t } = useI18n()
  const [loadingKey, setLoadingKey] = useState<DashboardCard | null>(null)

  if (!featureFlags) {
    return null
  }

  const handleToggle = async (key: DashboardCard) => {
    if (loadingKey) {
      return
    }

    const currentConfig = featureFlags[key]
    const nextConfig: MissionCardConfig = {
      ...featureFlags,
      [key]: {
        ...currentConfig,
        isVisible: !currentConfig.isVisible,
      },
    }

    setLoadingKey(key)
    try {
      await updateFeatureFlags(nextConfig)
    } catch {
      showToast(t('dashboard.supervisor.error.featureFlags'), 'error')
    } finally {
      setLoadingKey(null)
    }
  }

  return (
    <section className="mission-feature-panel" aria-labelledby="mission-feature-panel-title">
      <div className="mission-section-heading">
        <h4 id="mission-feature-panel-title">{t('dashboard.supervisor.mission.featureFlags')}</h4>
        <StatusBadge label={t('dashboard.intern.mission.visible')} tone="neutral" size="sm" />
      </div>

      <div className="mission-feature-list">
        {cardKeys.map((key) => {
          const cardConfig = featureFlags[key]
          const isLoading = loadingKey === key

          return (
            <label key={key} className="mission-toggle-row">
              <span className="mission-toggle-copy">
                <span>{t(getCardLabelKey(key))}</span>
                {isLoading && <span className="mission-toggle-spinner" aria-hidden="true" />}
              </span>
              <span className="mission-toggle-switch">
                <input
                  type="checkbox"
                  checked={cardConfig.isVisible}
                  disabled={Boolean(loadingKey)}
                  onChange={() => {
                    void handleToggle(key)
                  }}
                />
                <span aria-hidden="true" />
              </span>
            </label>
          )
        })}
      </div>
    </section>
  )
}

import type { PropsWithChildren } from 'react'
import type { DashboardCard, MissionCardConfig } from '../../types/missionFeatureFlags'

interface FeatureGateProps extends PropsWithChildren {
  card: DashboardCard
  flags: MissionCardConfig | null
}

export function FeatureGate({ card, flags, children }: FeatureGateProps) {
  const config = flags?.[card]

  if (config && !config.isVisible) {
    return null
  }

  const isReadOnly = Boolean(config && !config.isInteractive)

  return (
    <div className={`feature-gate${isReadOnly ? ' feature-gate-readonly' : ''}`}>
      {isReadOnly && (
        <span className="feature-gate-badge" role="status" aria-label="read-only">
          Read-only mode
        </span>
      )}
      {children}
    </div>
  )
}

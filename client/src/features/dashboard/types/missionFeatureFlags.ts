export type DashboardCard =
  | 'missionOverview'
  | 'quickStats'
  | 'tasks'
  | 'deliverables'
  | 'evaluation'
  | 'journal'
  | 'meeting'

export interface CardConfig {
  isVisible: boolean
  isInteractive: boolean
  requirementConfig?: Record<string, unknown> | null
}

export type MissionCardConfig = Record<DashboardCard, CardConfig>

const cards: DashboardCard[] = [
  'missionOverview',
  'quickStats',
  'tasks',
  'deliverables',
  'evaluation',
  'journal',
  'meeting',
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toCardConfig(value: unknown): CardConfig {
  if (!isRecord(value)) {
    return {
      isVisible: true,
      isInteractive: true,
      requirementConfig: null,
    }
  }

  const requirementCandidate = value.requirementConfig

  return {
    isVisible: typeof value.isVisible === 'boolean' ? value.isVisible : true,
    isInteractive: typeof value.isInteractive === 'boolean' ? value.isInteractive : true,
    requirementConfig: isRecord(requirementCandidate)
      ? requirementCandidate
      : requirementCandidate === null
        ? null
        : null,
  }
}

export function defaultMissionCardConfig(): MissionCardConfig {
  return {
    missionOverview: { isVisible: true, isInteractive: true, requirementConfig: null },
    quickStats: { isVisible: true, isInteractive: true, requirementConfig: null },
    tasks: { isVisible: true, isInteractive: true, requirementConfig: null },
    deliverables: { isVisible: true, isInteractive: true, requirementConfig: null },
    evaluation: { isVisible: true, isInteractive: true, requirementConfig: null },
    journal: { isVisible: true, isInteractive: true, requirementConfig: null },
    meeting: { isVisible: true, isInteractive: true, requirementConfig: null },
  }
}

export function parseMissionCardConfig(payload: unknown): MissionCardConfig | null {
  if (!isRecord(payload)) {
    return null
  }

  const normalized = defaultMissionCardConfig()

  for (const card of cards) {
    normalized[card] = toCardConfig(payload[card])
  }

  return normalized
}

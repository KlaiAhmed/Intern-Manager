import { defaultMissionCardConfig } from '../../types/missionFeatureFlags'
import { getFirstVisibleInternTab, getInternTabVisibility, getVisibleInternTabs } from './internDashboardTabs'

describe('internDashboardTabs', () => {
  it('keeps profile and overview visible when mission sections are hidden', () => {
    const flags = defaultMissionCardConfig()
    for (const key of Object.keys(flags) as Array<keyof typeof flags>) {
      flags[key] = {
        ...flags[key],
        isVisible: false,
      }
    }

    const visibility = getInternTabVisibility(flags)

    expect(visibility.overview).toBe(true)
    expect(visibility.profile).toBe(true)
    expect(visibility.mission).toBe(false)
    expect(visibility.journal).toBe(false)
  })

  it('shows the combined deliverables tab when tasks or deliverables are visible', () => {
    const flags = defaultMissionCardConfig()
    flags.tasks = { ...flags.tasks, isVisible: false }
    flags.deliverables = { ...flags.deliverables, isVisible: true }

    expect(getInternTabVisibility(flags).deliverables).toBe(true)

    flags.deliverables = { ...flags.deliverables, isVisible: false }
    expect(getInternTabVisibility(flags).deliverables).toBe(false)
  })

  it('returns the first visible tab from the displayed tab list', () => {
    const flags = defaultMissionCardConfig()
    const visibility = getInternTabVisibility(flags)
    const visibleTabs = getVisibleInternTabs(visibility)

    expect(visibleTabs[0]?.id).toBe('overview')
    expect(getFirstVisibleInternTab(visibility)).toBe('overview')
  })
})

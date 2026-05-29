import { defaultMissionCardConfig } from '../../types/missionFeatureFlags'
import { computeInternTabVisibility } from './internTabVisibility'

describe('computeInternTabVisibility', () => {
  it('keeps all tabs visible while mission flags are loading', () => {
    const visibility = computeInternTabVisibility({
      lifecycleStatus: 'ACTIVE',
      missionFlags: null,
      missionFlagsLoading: true,
    })

    expect(Object.values(visibility).every((tab) => tab.isVisible)).toBe(true)
    expect(Object.values(visibility).every((tab) => tab.isLoading)).toBe(true)
  })

  it('shows all active intern tabs when every mission flag is visible', () => {
    const visibility = computeInternTabVisibility({
      lifecycleStatus: 'ACTIVE',
      missionFlags: defaultMissionCardConfig(),
    })

    expect(visibility.overview).toEqual({ isVisible: true, isLoading: false })
    expect(visibility.mission).toEqual({ isVisible: true, isLoading: false })
    expect(visibility.tasks).toEqual({ isVisible: true, isLoading: false })
    expect(visibility.deliverables).toEqual({ isVisible: true, isLoading: false })
    expect(visibility.journal).toEqual({ isVisible: true, isLoading: false })
    expect(visibility.evaluations).toEqual({ isVisible: true, isLoading: false })
    expect(visibility.meetings).toEqual({ isVisible: true, isLoading: false })
    expect(visibility.profile).toEqual({ isVisible: true, isLoading: false })
  })

  it('hides mission-controlled tabs when every mission flag is hidden', () => {
    const flags = defaultMissionCardConfig()
    for (const key of Object.keys(flags) as Array<keyof typeof flags>) {
      flags[key] = {
        ...flags[key],
        isVisible: false,
      }
    }

    const visibility = computeInternTabVisibility({
      lifecycleStatus: 'ACTIVE',
      missionFlags: flags,
    })

    expect(visibility.overview.isVisible).toBe(true)
    expect(visibility.profile.isVisible).toBe(true)
    expect(visibility.mission.isVisible).toBe(false)
    expect(visibility.tasks.isVisible).toBe(false)
    expect(visibility.deliverables.isVisible).toBe(false)
    expect(visibility.journal.isVisible).toBe(false)
    expect(visibility.evaluations.isVisible).toBe(false)
    expect(visibility.meetings.isVisible).toBe(false)
  })
})

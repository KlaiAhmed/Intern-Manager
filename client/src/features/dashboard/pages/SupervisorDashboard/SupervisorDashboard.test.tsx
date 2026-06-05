import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'

import { SupervisorDashboard } from './SupervisorDashboard'
import type { SupervisorMission } from '../../types/supervisorDashboard'

const STORAGE_KEY = 'supervisor-dashboard:active-mission-id'

const mockUseSupervisorMissions = vi.fn()

vi.mock('../../../../locales/I18nContext', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    isRtl: false,
    isLoading: false,
    locale: 'en',
    setLocale: vi.fn(),
  }),
}))

vi.mock('../../hooks/supervisor/useSupervisorMissions', () => ({
  useSupervisorMissions: () => mockUseSupervisorMissions(),
}))

vi.mock('../../hooks/supervisor/useDashboardBadges', () => ({
  useDashboardBadges: () => ({
    pendingReviewCount: 0,
    todayMeetingCount: 0,
    overdueTaskCount: 0,
    error: null,
    isLoading: false,
    refresh: vi.fn(),
  }),
}))

vi.mock('../../components/DashboardLayout', () => ({
  DashboardLayout: ({ children, headerActions }: { children: React.ReactNode; headerActions?: React.ReactNode }) => (
    <div>
      <div data-testid="header-actions">{headerActions}</div>
      <div data-testid="dashboard-content">{children}</div>
    </div>
  ),
}))

vi.mock('../../components/TabErrorBoundary', () => ({
  TabErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../../tabs/supervisor/OverviewTab/OverviewTab', () => ({
  OverviewTab: ({ missionId }: { missionId: string }) => <div data-testid="overview-tab">{missionId}</div>,
}))

vi.mock('../../tabs/supervisor/MissionTab/MissionTab', () => ({
  MissionTab: ({ missionId }: { missionId: string }) => <div data-testid="mission-tab">{missionId}</div>,
}))

vi.mock('../../tabs/supervisor/DeliverablesTab/DeliverablesTab', () => ({
  DeliverablesTab: ({ missionId }: { missionId: string }) => <div data-testid="deliverables-tab">{missionId}</div>,
}))

vi.mock('../../tabs/supervisor/TasksTab/TasksTab', () => ({
  TasksTab: ({ missionId }: { missionId: string }) => <div data-testid="tasks-tab">{missionId}</div>,
}))

vi.mock('../../tabs/supervisor/MeetingsTab/MeetingsTab', () => ({
  MeetingsTab: () => <div data-testid="meetings-tab" />,
}))

function makeMission(
  id: string,
  status: SupervisorMission['status'] = 'active',
): SupervisorMission {
  return {
    id,
    title: `Mission ${id}`,
    description: '',
    status,
    internId: 'intern-1',
    supervisorId: 'sup-1',
    coSupervisorCanReview: false,
    coSupervisorCanEval: false,
    tools: '',
    level: '',
    skills: [],
    rawProgress: 0,
    startDate: null,
    endDate: null,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/dashboard/supervisor']}>
      <SupervisorDashboard />
    </MemoryRouter>,
  )
}

function setMissionsReturn(
  missions: SupervisorMission[],
  isLoading = false,
) {
  mockUseSupervisorMissions.mockReturnValue({
    missions,
    pastMissions: [],
    isLoading,
    error: null,
    refresh: vi.fn(),
  })
}

function getSelect(): HTMLSelectElement {
  return screen.getByLabelText('dashboard.supervisor.missions') as HTMLSelectElement
}

describe('SupervisorDashboard — active mission persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    mockUseSupervisorMissions.mockReset()
  })

  it('restores the persisted mission ID from localStorage on initial mount', async () => {
    localStorage.setItem(STORAGE_KEY, 'mission-b')
    setMissionsReturn([makeMission('mission-a'), makeMission('mission-b')])

    renderDashboard()

    await waitFor(() => {
      expect(getSelect().value).toBe('mission-b')
    })
    expect(localStorage.getItem(STORAGE_KEY)).toBe('mission-b')
  })

  it('keeps the persisted mission when it is present in the freshly fetched list', async () => {
    localStorage.setItem(STORAGE_KEY, 'mission-b')
    setMissionsReturn([
      makeMission('mission-a'),
      makeMission('mission-b'),
      makeMission('mission-c'),
    ])

    renderDashboard()

    await waitFor(() => {
      expect(getSelect().value).toBe('mission-b')
    })
    expect(localStorage.getItem(STORAGE_KEY)).toBe('mission-b')
  })

  it('does NOT overwrite or clear the persisted mission when it is missing from the fetched list', async () => {
    localStorage.setItem(STORAGE_KEY, 'mission-b')
    setMissionsReturn([makeMission('mission-a'), makeMission('mission-c')])

    renderDashboard()

    // The Overview tab receives the active mission ID as a prop. If the
    // reconciler had silently swapped to a fallback, this would show
    // 'mission-a' (the first option in the list).
    await waitFor(() => {
      expect(screen.getByTestId('overview-tab').textContent).toBe('mission-b')
    })
    // localStorage must NOT be cleared — the user's last explicit choice is preserved.
    expect(localStorage.getItem(STORAGE_KEY)).toBe('mission-b')
  })

  it('picks a deterministic fallback and persists it when no mission is persisted', async () => {
    setMissionsReturn([
      makeMission('mission-a', 'paused'),
      makeMission('mission-b', 'active'),
      makeMission('mission-c', 'completed'),
    ])

    renderDashboard()

    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBe('mission-b')
    })
    expect(getSelect().value).toBe('mission-b')
  })

  it('persists the new mission ID immediately when the user changes the select', async () => {
    localStorage.setItem(STORAGE_KEY, 'mission-a')
    setMissionsReturn([makeMission('mission-a'), makeMission('mission-b')])

    renderDashboard()

    const select = await screen.findByLabelText('dashboard.supervisor.missions') as HTMLSelectElement
    expect(select.value).toBe('mission-a')

    fireEvent.change(select, { target: { value: 'mission-b' } })

    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBe('mission-b')
    })
    expect(select.value).toBe('mission-b')
  })

  it('restores the persisted mission after a full unmount/remount (refresh simulation)', async () => {
    setMissionsReturn([makeMission('mission-a'), makeMission('mission-b')])

    const { unmount } = renderDashboard()
    const select = await screen.findByLabelText('dashboard.supervisor.missions') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'mission-b' } })
    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBe('mission-b')
    })
    unmount()

    renderDashboard()
    await waitFor(() => {
      expect(getSelect().value).toBe('mission-b')
    })
  })

  it('clears localStorage when the user explicitly picks an empty value (defensive)', async () => {
    localStorage.setItem(STORAGE_KEY, 'mission-a')
    setMissionsReturn([makeMission('mission-a'), makeMission('mission-b')])

    renderDashboard()
    const select = await screen.findByLabelText('dashboard.supervisor.missions') as HTMLSelectElement

    // The select onChange handler writes whatever value it receives. An empty
    // string is treated as a clear. This guards against accidental persistence
    // of an empty value from a future refactor.
    fireEvent.change(select, { target: { value: '' } })

    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    })
  })
})

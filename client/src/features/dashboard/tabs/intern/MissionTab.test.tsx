import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'
import type { ReactNode } from 'react'

import type { Internship, TranslateFn } from '../../types/internDashboard'
import { MissionTab } from './MissionTab'

const mockResourcesHook = vi.fn()

vi.mock('../../hooks/intern/useInternMission', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/intern/useInternMission')>(
    '../../hooks/intern/useInternMission',
  )
  return {
    ...actual,
    useInternMissionDocuments: (...args: unknown[]) => mockResourcesHook(...args),
  }
})

const labels: Record<string, string> = {
  'dashboard.intern.tabs.loading': 'Loading dashboard tab...',
  'dashboard.intern.tabs.errorTitle': 'Unable to load this tab',
  'dashboard.intern.error.retry': 'Retry',
  'dashboard.intern.mission.emptyTitle': 'No active mission',
  'dashboard.intern.mission.emptyMessage': 'Your mission details will appear here after assignment.',
  'dashboard.intern.mission.details': 'Mission details',
  'dashboard.intern.mission.supervisor': 'Supervisor',
  'dashboard.intern.mission.coSupervisor': 'Co-supervisor',
  'dashboard.intern.mission.department': 'Department',
  'dashboard.intern.mission.startDate': 'Start date',
  'dashboard.intern.mission.endDate': 'End date',
  'dashboard.intern.mission.progress': 'Progress',
  'dashboard.intern.tabs.mission': 'Mission',
  'dashboard.intern.tabs.tasks': 'Tasks',
  'dashboard.intern.tabs.deliverables': 'Deliverables',
  'dashboard.intern.tabs.meetings': 'Meetings',
  'dashboard.intern.mission.resources': 'Resources',
  'dashboard.intern.mission.resourcesTitle': 'Mission resources',
  'dashboard.intern.mission.resourcesEmpty': 'No resources have been shared with you yet.',
  'dashboard.intern.mission.resourcesLoading': 'Loading resources…',
  'dashboard.intern.mission.resourcesLoadFailed': 'Unable to load mission resources.',
  'dashboard.intern.mission.resourceSource.file': 'File',
  'dashboard.intern.mission.resourceSource.url': 'URL',
  'dashboard.intern.mission.resourceDownload': 'Download',
  'dashboard.intern.mission.resourceOpen': 'Open',
  'dashboard.intern.mission.resourceUnavailable': 'Link unavailable',
  'dashboard.noData': 'No data available.',
}

const t: TranslateFn = (key) => labels[key] ?? key

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function makeInternship(overrides: Partial<Internship> = {}): Internship {
  return {
    id: 'mission-1',
    missionTitle: 'Onboarding mission',
    supervisorName: 'Alex Lead',
    department: 'Engineering',
    startDate: '2024-01-01',
    endDate: '2024-06-30',
    status: 'ACTIVE',
    progress: 42,
    ...overrides,
  }
}

describe('MissionTab — Resources section', () => {
  beforeEach(() => {
    mockResourcesHook.mockReset()
  })

  it('renders file and url resources with safe download and open links', () => {
    mockResourcesHook.mockReturnValue({
      documents: [
        {
          id: 'doc-1',
          missionId: 'mission-1',
          fileName: 'Brief.pdf',
          fileUrl: '/uploads/missions/mission-1/documents/brief.pdf',
          uploadedAt: '2024-05-10T12:00:00Z',
          sourceType: 'file',
        },
        {
          id: 'doc-2',
          missionId: 'mission-1',
          fileName: 'Reference',
          fileUrl: 'https://example.com/reference',
          uploadedAt: '2024-05-11T12:00:00Z',
          sourceType: 'url',
        },
      ],
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    })

    render(
      <MissionTab
        internship={makeInternship()}
        loading={false}
        error={null}
        onRetry={vi.fn()}
        t={t}
      />,
      { wrapper: createWrapper() },
    )

    expect(screen.getByText('Mission resources')).toBeInTheDocument()

    const fileLink = screen.getByRole('link', { name: 'Download' })
    expect(fileLink).toHaveAttribute(
      'href',
      expect.stringContaining('/api/intern/me/missions/mission-1/documents/doc-1/download'),
    )
    expect(fileLink).toHaveAttribute('download', 'Brief.pdf')
    expect(fileLink).toHaveAttribute('rel', 'noopener noreferrer')
    expect(fileLink).toHaveAttribute('target', '_blank')

    const urlLink = screen.getByRole('link', { name: 'Open' })
    expect(urlLink).toHaveAttribute('href', 'https://example.com/reference')
    expect(urlLink).toHaveAttribute('rel', 'noopener noreferrer')
    expect(urlLink).toHaveAttribute('target', '_blank')
  })

  it('shows the empty state when there are no resources', () => {
    mockResourcesHook.mockReturnValue({
      documents: [],
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    })

    render(
      <MissionTab
        internship={makeInternship()}
        loading={false}
        error={null}
        onRetry={vi.fn()}
        t={t}
      />,
      { wrapper: createWrapper() },
    )

    expect(
      screen.getByText('No resources have been shared with you yet.'),
    ).toBeInTheDocument()
  })

  it('shows a loading state for resources while the mission details are already loaded', () => {
    mockResourcesHook.mockReturnValue({
      documents: [],
      isLoading: true,
      isFetching: true,
      error: null,
      refetch: vi.fn(),
    })

    render(
      <MissionTab
        internship={makeInternship()}
        loading={false}
        error={null}
        onRetry={vi.fn()}
        t={t}
      />,
      { wrapper: createWrapper() },
    )

    expect(screen.getByText('Loading resources…')).toBeInTheDocument()
  })

  it('renders an inline error and retry button without blanking the rest of the tab', async () => {
    const refetch = vi.fn()
    mockResourcesHook.mockReturnValue({
      documents: [],
      isLoading: false,
      isFetching: false,
      error: new Error('Network down'),
      refetch,
    })

    render(
      <MissionTab
        internship={makeInternship()}
        loading={false}
        error={null}
        onRetry={vi.fn()}
        t={t}
      />,
      { wrapper: createWrapper() },
    )

    expect(screen.getByText('Network down')).toBeInTheDocument()

    const retryButton = screen.getByRole('button', { name: 'Retry' })
    retryButton.click()

    await waitFor(() => {
      expect(refetch).toHaveBeenCalled()
    })

    // The mission details are still rendered.
    expect(screen.getByText('Onboarding mission')).toBeInTheDocument()
  })

  it('does not render a download link when the file url is unsafe', () => {
    mockResourcesHook.mockReturnValue({
      documents: [
        {
          id: 'doc-bad',
          missionId: 'mission-1',
          fileName: 'Bad',
          fileUrl: 'javascript:alert(1)',
          uploadedAt: '2024-05-12T12:00:00Z',
          sourceType: 'url',
        },
      ],
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    })

    render(
      <MissionTab
        internship={makeInternship()}
        loading={false}
        error={null}
        onRetry={vi.fn()}
        t={t}
      />,
      { wrapper: createWrapper() },
    )

    expect(screen.queryByRole('link', { name: 'Open' })).not.toBeInTheDocument()
    expect(screen.getByText('Link unavailable')).toBeInTheDocument()
  })

  it('does not fetch resources when no mission is assigned', () => {
    mockResourcesHook.mockClear()
    mockResourcesHook.mockReturnValue({
      documents: [],
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    })

    render(
      <MissionTab
        internship={null}
        loading={false}
        error={null}
        onRetry={vi.fn()}
        t={t}
      />,
      { wrapper: createWrapper() },
    )

    expect(screen.getByText('No active mission')).toBeInTheDocument()
    expect(mockResourcesHook).toHaveBeenCalledWith(null, { enabled: false })
  })
})

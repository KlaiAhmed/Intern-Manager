import { render, screen } from '@testing-library/react'
import { SettingsPanel } from './SettingsPanel'

vi.mock('../hooks/useDashboardApi', () => ({
  useDashboardApi: () => ({
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  }),
}))

vi.mock('../../../locales/I18nContext', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        'dashboard.settings.tab.departments': 'Departments',
        'dashboard.settings.tab.schools': 'Schools',
        'dashboard.settings.tab.internshipTypes': 'Internship Types',
        'dashboard.settings.tab.skills': 'Skills',
        'dashboard.settings.aria.subNav': 'Settings sub-navigation',
      }
      return labels[key] ?? key
    },
  }),
}))

describe('SettingsPanel', () => {
  it('renders all remaining settings tabs excluding verification-statuses', () => {
    render(
      <SettingsPanel
        activeSubSection="departments"
        onSubSectionChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('tab', { name: 'Departments' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Schools' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Internship Types' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Skills' })).toBeInTheDocument()

    expect(screen.queryByRole('tab', { name: 'Verification Statuses' })).not.toBeInTheDocument()
  })

  it('highlights the active tab', () => {
    render(
      <SettingsPanel
        activeSubSection="schools"
        onSubSectionChange={vi.fn()}
      />,
    )

    const activeTab = screen.getByRole('tab', { name: 'Schools' })
    expect(activeTab).toHaveAttribute('aria-selected', 'true')
  })
})

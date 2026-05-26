import { useCallback, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AuditLogSection } from '../components/AuditLogSection'
import { ErrorState } from '../components/ErrorState'
import { SettingsPanel, type SettingsSubSection } from '../components/SettingsPanel'
import type { SuperAdminSection } from '../components/SuperAdminSidebar'
import { UserManagementSection } from '../components/UserManagementSection'
import { MissionFeatureFlagsSection } from './AdminDashboard/MissionFeatureFlagsSection'
import {
  BiDashboardSection,
  DashboardShell,
  OperationalEvaluationsSection,
  OperationalInternshipsSection,
  OperationalInternsSection,
} from '../shared/components'
import '../styles/pages/SuperAdminDashboard.css'

const superAdminSections: SuperAdminSection[] = [
  'overview',
  'users',
  'internships',
  'missions',
  'evaluations',
  'settings',
  'audit',
]

function isMissionFeatureFlagsRoute(pathname: string): boolean {
  return pathname.startsWith('/dashboard/admin/missions/') && pathname.endsWith('/feature-flags')
}

function isSuperAdminSection(value: unknown): value is SuperAdminSection {
  return typeof value === 'string' && superAdminSections.includes(value as SuperAdminSection)
}

export function SuperAdminDashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const { missionId } = useParams<{ missionId?: string }>()
  const featureFlagsRoute = isMissionFeatureFlagsRoute(location.pathname)
  const locationState = location.state as { activeSection?: unknown } | null
  const [activeSection, setActiveSection] = useState<SuperAdminSection>(() => {
    if (featureFlagsRoute) {
      return 'internships'
    }

    if (isSuperAdminSection(locationState?.activeSection)) {
      return locationState.activeSection
    }

    return 'overview'
  })
  const [activeSettingsSubSection, setActiveSettingsSubSection] = useState<SettingsSubSection>('departments')

  const resolvedActiveSection = featureFlagsRoute ? 'internships' : activeSection

  const handleSectionChange = useCallback((nextSection: SuperAdminSection) => {
    setActiveSection(nextSection)

    if (featureFlagsRoute) {
      navigate('/dashboard', { state: { activeSection: nextSection } })
    }
  }, [featureFlagsRoute, navigate])

  const renderContent = useCallback(() => {
    if (featureFlagsRoute) {
      if (!missionId) {
        return (
          <ErrorState
            message="Mission id is missing in the current route."
            onRetry={() => {
              navigate('/dashboard', { state: { activeSection: 'internships' } })
            }}
          />
        )
      }

      return (
        <MissionFeatureFlagsSection
          missionId={missionId}
          onBack={() => {
            setActiveSection('internships')
            navigate('/dashboard', { state: { activeSection: 'internships' } })
          }}
        />
      )
    }

    switch (activeSection) {
      case 'overview':
        return <BiDashboardSection />
      case 'users':
        return <UserManagementSection />
      case 'internships':
        return <OperationalInternshipsSection />
      case 'missions':
        return <OperationalInternsSection />
      case 'evaluations':
        return <OperationalEvaluationsSection />
      case 'settings':
        return (
          <SettingsPanel
            activeSubSection={activeSettingsSubSection}
            onSubSectionChange={setActiveSettingsSubSection}
          />
        )
      case 'audit':
        return <AuditLogSection />
      default:
        return <BiDashboardSection />
    }
  }, [activeSection, activeSettingsSubSection, featureFlagsRoute, missionId, navigate])

  return (
    <DashboardShell
      activeSection={resolvedActiveSection}
      onSectionChange={handleSectionChange}
      onSettingsSubSectionChange={setActiveSettingsSubSection}
      contentKey={featureFlagsRoute ? location.pathname : activeSection}
    >
      {renderContent()}
    </DashboardShell>
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { AuditLogSection } from '../components/AuditLogSection'
import { ErrorState } from '../components/ErrorState'
import { SettingsPanel, type SettingsSubSection } from '../components/SettingsPanel'
import type { SuperAdminSection } from '../components/SuperAdminSidebar'
import {
  DashboardShell,
  OperationalEvaluationsSection,
  OperationalInternshipsSection,
  OperationalInternsSection,
} from '../shared/components'
import { AdminOverviewSection } from './AdminDashboard/AdminOverviewSection'
import { MissionFeatureFlagsSection } from './AdminDashboard/MissionFeatureFlagsSection'
import { AdminUserManagementSection } from './AdminDashboard/AdminUserManagementSection'
import { resolveAdminView, sectionByView, sectionPathMap } from '../shared/types/adminViews'
import '../styles/pages/SuperAdminDashboard.css'
import '../styles/pages/AdminDashboard.css'

export function AdminDashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const { missionId } = useParams<{ missionId?: string }>()
  const [activeSettingsSubSection, setActiveSettingsSubSection] = useState<SettingsSubSection>('departments')

  useEffect(() => {
    if (location.pathname === '/dashboard') {
      navigate('/dashboard/admin', { replace: true })
      return
    }
  }, [location.pathname, navigate])

  const activeView = useMemo(() => resolveAdminView(location.pathname), [location.pathname])
  const activeSection = sectionByView[activeView]

  const handleSectionChange = useCallback((section: SuperAdminSection) => {
    if (section === 'internships') {
      navigate('/dashboard/admin/internships')
      return
    }

    if (section === 'missions') {
      navigate('/dashboard/admin/interns')
      return
    }

    navigate(sectionPathMap[section])
  }, [navigate])

  const renderView = () => {
    switch (activeView) {
      case 'overview':
        return <AdminOverviewSection />
      case 'users':
        return <AdminUserManagementSection />
      case 'interns':
        return <OperationalInternsSection />
      case 'internships':
        return <OperationalInternshipsSection />
      case 'missionFeatureFlags':
        if (!missionId) {
          return (
            <ErrorState
              message="Mission id is missing in the current route."
              onRetry={() => {
                navigate('/dashboard/admin/internships')
              }}
            />
          )
        }

        return (
          <MissionFeatureFlagsSection
            missionId={missionId}
            onBack={() => {
              navigate('/dashboard/admin/internships')
            }}
          />
        )
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
        return <AdminOverviewSection />
    }
  }

  return (
    <DashboardShell
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
      onSettingsSubSectionChange={setActiveSettingsSubSection}
      hideAdminManagement={false}
      brandLabel="Admin"
      shellClassName="admin-dashboard"
      contentKey={activeView === 'missionFeatureFlags' ? location.pathname : activeView}
    >
      {renderView()}
    </DashboardShell>
  )
}

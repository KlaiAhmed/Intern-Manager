import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AuditLogSection } from '../components/AuditLogSection'
import { SettingsPanel, type SettingsSubSection } from '../components/SettingsPanel'
import type { SuperAdminSection } from '../components/SuperAdminSidebar'
import {
  DashboardShell,
  OperationalArchiveSection,
  OperationalBiAccessSection,
  OperationalEvaluationsSection,
  OperationalInternshipsSection,
  OperationalInternsSection,
  OperationalNotificationsEmailSection,
} from '../shared/components'
import { AdminOverviewSection } from './AdminDashboard/AdminOverviewSection'
import { AdminUserManagementSection } from './AdminDashboard/AdminUserManagementSection'
import { resolveAdminView, sectionByView, sectionPathMap } from '../shared/types/adminViews'
import '../styles/pages/SuperAdminDashboard.css'
import '../styles/pages/AdminDashboard.css'

export function AdminDashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const [activeSettingsSubSection, setActiveSettingsSubSection] = useState<SettingsSubSection>('departments')

  useEffect(() => {
    if (location.pathname === '/dashboard') {
      navigate('/dashboard/admin', { replace: true })
      return
    }
  }, [location.pathname, navigate])

  const activeView = useMemo(() => resolveAdminView(location.pathname), [location.pathname])
  const activeSection = sectionByView[activeView]

  const pageTitle = useMemo(() => {
    switch (activeView) {
      case 'overview':
        return 'Admin Dashboard'
      case 'users':
        return 'User Management'
      case 'interns':
        return 'Interns'
      case 'internships':
        return 'Internships'
      case 'evaluations':
        return 'Evaluations'
      case 'settings':
        return 'Referential Settings'
      case 'audit':
        return 'Audit Log'
      case 'notificationsEmail':
        return 'Notification and Email Templates'
      case 'archive':
        return 'Archive Manager'
      case 'biAccess':
        return 'BI Access Control'
      default:
        return 'Admin Dashboard'
    }
  }, [activeView])

  const handleSectionChange = useCallback((section: SuperAdminSection) => {
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
      case 'notificationsEmail':
        return <OperationalNotificationsEmailSection />
      case 'archive':
        return <OperationalArchiveSection />
      case 'biAccess':
        return <OperationalBiAccessSection />
      default:
        return <AdminOverviewSection />
    }
  }

  return (
    <DashboardShell
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
      onSettingsSubSectionChange={setActiveSettingsSubSection}
      brandLabel="Admin"
      shellClassName="admin-dashboard"
      pageTitle={pageTitle}
      contentKey={location.pathname}
    >
      {renderView()}
    </DashboardShell>
  )
}

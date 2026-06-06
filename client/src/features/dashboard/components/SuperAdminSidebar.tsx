import { useState, useEffect, type ReactNode, useCallback } from 'react'
import { useI18n } from '../../../locales/I18nContext'
import {
  BarChart,
  Users,
  Briefcase,
  BookOpen,
  Settings,
  ShieldCheck,
  ChevronRight,
  X,
  Menu,
} from './IconComponents'

export type SuperAdminSection =
  | 'overview'
  | 'users'
  | 'internships'
  | 'missions'
  | 'settings'
  | 'audit'

export type SettingsSubSection = 'departments' | 'schools' | 'types' | 'skills'

interface NavItem {
  id: SuperAdminSection
  label: string
  icon: ReactNode
}

interface SuperAdminSidebarProps {
  activeSection: SuperAdminSection
  onSectionChange: (section: SuperAdminSection) => void
  onSettingsSubSectionChange?: (subsection: SettingsSubSection) => void
  hideAdminManagement?: boolean
  brandLabel?: string
}

export function SuperAdminSidebar({
  activeSection,
  onSectionChange,
  onSettingsSubSectionChange,
  hideAdminManagement = false,
  brandLabel = 'Super Admin',
}: SuperAdminSidebarProps) {
  const { t } = useI18n()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)

  const navItems: NavItem[] = [
    { id: 'overview', label: t('dashboard.superAdmin.nav.overview'), icon: <BarChart /> },
    { id: 'users', label: t('dashboard.superAdmin.nav.userManagement'), icon: <Users /> },
    { id: 'internships', label: t('dashboard.superAdmin.nav.internships'), icon: <Briefcase /> },
    { id: 'missions', label: t('dashboard.superAdmin.nav.internsManagement'), icon: <BookOpen /> },
  ]

  useEffect(() => {
    const checkBreakpoint = () => {
      const width = window.innerWidth
      setIsMobile(width < 768)
      setIsTablet(width >= 768 && width < 1024)

      // Keep sidebar closed by default on all screen sizes
      // User can manually open it if needed
      if (width < 768) {
        setSidebarOpen(false)
      }
    }

    checkBreakpoint()
    window.addEventListener('resize', checkBreakpoint)
    return () => window.removeEventListener('resize', checkBreakpoint)
  }, [])

  const handleNavClick = useCallback((itemId: SuperAdminSection) => {
    onSectionChange(itemId)
    if (isMobile) {
      setSidebarOpen(false)
    }
  }, [isMobile, onSectionChange])

  const visibleNavItems = hideAdminManagement
    ? navItems.filter((item) => item.id !== 'users')
    : navItems

  const isSettingsActive = activeSection === 'settings'

  return (
    <>
      {/* Mobile Header */}
      {isMobile && (
        <header className="super-admin-mobile-header">
          <button
            className="super-admin-menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label={t('dashboard.sidebar.openMenu')}
          >
            <Menu />
          </button>
          <span className="super-admin-mobile-title">{brandLabel}</span>
        </header>
      )}

      {/* Overlay for mobile drawer */}
      {isMobile && sidebarOpen && (
        <div
          className="super-admin-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className="super-admin-sidebar"
        data-open={sidebarOpen}
        data-mobile={isMobile}
        data-tablet={isTablet}
        role="navigation"
        aria-label={t('dashboard.sidebar.superAdminNav')}
      >
        {/* Header */}
        <div className="super-admin-sidebar-header">
          <span className="super-admin-sidebar-brand">{t('dashboard.sidebar.brand')}</span>
          {!isMobile && (
            <button
              className="super-admin-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? t('dashboard.sidebar.collapseSidebar') : t('dashboard.sidebar.expandSidebar')}
              aria-expanded={sidebarOpen}
            >
              <span className={`super-admin-toggle-icon ${sidebarOpen ? 'is-rotated' : ''}`}>
                <ChevronRight />
              </span>
            </button>
          )}
          {isMobile && (
            <button
              className="super-admin-close-btn"
              onClick={() => setSidebarOpen(false)}
          aria-label={t('dashboard.sidebar.closeMenu')}
        >
          <X />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="super-admin-nav" aria-label={t('dashboard.sidebar.mainNav')}>
          <ul className="super-admin-nav-list" role="tablist">
            {visibleNavItems.map((item) => (
              <li key={item.id} role="presentation">
                <button
                  role="tab"
                  aria-selected={activeSection === item.id}
                  id={`nav-${item.id}`}
                  aria-controls={`section-${item.id}`}
                  className={`super-admin-nav-item ${activeSection === item.id ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.id)}
                >
                  <span className="super-admin-nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="super-admin-nav-label">{item.label}</span>
                  {activeSection === item.id && <span className="super-admin-active-indicator" />}
                </button>
              </li>
            ))}

            {/* Settings - Direct link to departments */}
            <li role="presentation">
              <button
                role="tab"
                aria-selected={isSettingsActive}
                id="nav-settings"
                aria-controls="section-settings"
                className={`super-admin-nav-item ${isSettingsActive ? 'active' : ''}`}
                onClick={() => {
                  handleNavClick('settings')
                  onSettingsSubSectionChange?.('departments')
                }}
              >
                <span className="super-admin-nav-icon" aria-hidden="true">
                  <Settings />
                </span>
                <span className="super-admin-nav-label">{t('dashboard.superAdmin.nav.settings')}</span>
                {isSettingsActive && <span className="super-admin-active-indicator" />}
              </button>
            </li>

            {/* Audit & Security */}
            <li role="presentation">
              <button
                role="tab"
                aria-selected={activeSection === 'audit'}
                id="nav-audit"
                aria-controls="section-audit"
                className={`super-admin-nav-item ${activeSection === 'audit' ? 'active' : ''}`}
                onClick={() => handleNavClick('audit')}
              >
                <span className="super-admin-nav-icon" aria-hidden="true">
                  <ShieldCheck />
                </span>
                <span className="super-admin-nav-label">{t('dashboard.superAdmin.nav.auditSecurity')}</span>
                {activeSection === 'audit' && <span className="super-admin-active-indicator" />}
              </button>
            </li>
          </ul>
        </nav>
      </aside>
    </>
  )
}

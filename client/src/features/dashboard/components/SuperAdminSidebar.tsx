import { useState, useEffect, type ReactNode, useCallback } from 'react'
import {
  Overview,
  Users,
  Briefcase,
  BookOpen,
  ClipboardCheck,
  FileCheck,
  Sparkles,
  Settings,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  X,
  Menu,
} from './IconComponents'

export type SuperAdminSection =
  | 'overview'
  | 'users'
  | 'internships'
  | 'missions'
  | 'evaluations'
  | 'deliverables'
  | 'matching'
  | 'settings'
  | 'audit'

export type SettingsSubSection = 'departments' | 'schools' | 'types' | 'skills' | 'statuses'

interface NavItem {
  id: SuperAdminSection
  label: string
  icon: ReactNode
}

interface SuperAdminSidebarProps {
  activeSection: SuperAdminSection
  onSectionChange: (section: SuperAdminSection) => void
  activeSettingsSubSection?: SettingsSubSection
  onSettingsSubSectionChange?: (subsection: SettingsSubSection) => void
  settingsExpanded?: boolean
  onSettingsToggle?: () => void
}

const navItems: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: <Overview /> },
  { id: 'users', label: 'User Management', icon: <Users /> },
  { id: 'internships', label: 'Internships', icon: <Briefcase /> },
  { id: 'missions', label: 'Missions Library', icon: <BookOpen /> },
  { id: 'evaluations', label: 'Evaluations', icon: <ClipboardCheck /> },
  { id: 'deliverables', label: 'Deliverables', icon: <FileCheck /> },
  { id: 'matching', label: 'Matching IA', icon: <Sparkles /> },
]

const settingsSubItems: { id: SettingsSubSection; label: string }[] = [
  { id: 'departments', label: 'Departments' },
  { id: 'schools', label: 'Schools' },
  { id: 'types', label: 'Types' },
  { id: 'skills', label: 'Skills' },
  { id: 'statuses', label: 'Statuses' },
]

export function SuperAdminSidebar({
  activeSection,
  onSectionChange,
  activeSettingsSubSection = 'departments',
  onSettingsSubSectionChange,
  settingsExpanded = false,
  onSettingsToggle,
}: SuperAdminSidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)

  useEffect(() => {
    const checkBreakpoint = () => {
      const width = window.innerWidth
      setIsMobile(width < 768)
      setIsTablet(width >= 768 && width < 1024)

      if (width >= 1024) {
        setSidebarOpen(true)
      } else if (width < 768) {
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

  const isSettingsActive = activeSection === 'settings'

  return (
    <>
      {/* Mobile Header */}
      {isMobile && (
        <header className="super-admin-mobile-header">
          <button
            className="super-admin-menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu />
          </button>
          <span className="super-admin-mobile-title">Super Admin</span>
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
        aria-label="Super Admin navigation"
      >
        {/* Header */}
        <div className="super-admin-sidebar-header">
          {(sidebarOpen || isMobile) && (
            <span className="super-admin-sidebar-brand">Dashboard</span>
          )}
          {!isMobile && (
            <button
              className="super-admin-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
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
              aria-label="Close menu"
            >
              <X />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="super-admin-nav" aria-label="Main navigation">
          <ul className="super-admin-nav-list" role="tablist">
            {navItems.map((item) => (
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

            {/* Settings with expandable submenu */}
            <li className="super-admin-nav-item-with-submenu" role="presentation">
              <button
                role="tab"
                aria-selected={isSettingsActive}
                aria-expanded={settingsExpanded}
                className={`super-admin-nav-item super-admin-nav-item-expandable ${isSettingsActive ? 'active' : ''}`}
                onClick={onSettingsToggle}
              >
                <span className="super-admin-nav-icon" aria-hidden="true">
                  <Settings />
                </span>
                <span className="super-admin-nav-label">Settings</span>
                <span className={`super-admin-expand-icon ${settingsExpanded ? 'is-rotated' : ''}`}>
                  <ChevronDown />
                </span>
                {isSettingsActive && <span className="super-admin-active-indicator" />}
              </button>

              {/* Settings submenu */}
              {(sidebarOpen || isMobile) && settingsExpanded && (
                <ul className="super-admin-submenu" role="tablist">
                  {settingsSubItems.map((subItem) => (
                    <li key={subItem.id} role="presentation">
                      <button
                        role="tab"
                        aria-selected={isSettingsActive && activeSettingsSubSection === subItem.id}
                        className={`super-admin-submenu-item ${isSettingsActive && activeSettingsSubSection === subItem.id ? 'active' : ''}`}
                        onClick={() => {
                          handleNavClick('settings')
                          onSettingsSubSectionChange?.(subItem.id)
                        }}
                      >
                        {subItem.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
                <span className="super-admin-nav-label">Audit & Security</span>
                {activeSection === 'audit' && <span className="super-admin-active-indicator" />}
              </button>
            </li>
          </ul>
        </nav>
      </aside>
    </>
  )
}

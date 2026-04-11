import { useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  ChevronRight,
  X,
  Menu,
} from './IconComponents'

export type ManagerSection = 'overview' | 'interns' | 'supervisors' | 'departments' | 'biPanel'

interface NavItem {
  id: ManagerSection
  label: string
  icon: ReactNode
}

interface ManagerSidebarProps {
  activeSection: ManagerSection
  onSectionChange: (section: ManagerSection) => void
  brandLabel?: string
  navItems: NavItem[]
}

export function ManagerSidebar({
  activeSection,
  onSectionChange,
  brandLabel = 'Manager',
  navItems,
}: ManagerSidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)

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

  const handleNavClick = useCallback((itemId: ManagerSection) => {
    onSectionChange(itemId)
    if (isMobile) {
      setSidebarOpen(false)
    }
  }, [isMobile, onSectionChange])

  return (
    <>
      {/* Mobile Header */}
      {isMobile && (
        <header className="manager-mobile-header">
          <button
            className="manager-menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu />
          </button>
          <span className="manager-mobile-title">{brandLabel}</span>
        </header>
      )}

      {/* Overlay for mobile drawer */}
      {isMobile && sidebarOpen && (
        <div
          className="manager-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className="manager-sidebar"
        data-open={sidebarOpen}
        data-mobile={isMobile}
        data-tablet={isTablet}
        role="navigation"
        aria-label="Manager navigation"
      >
        {/* Header */}
        <div className="manager-sidebar-header">
          <span className="manager-sidebar-brand">Dashboard</span>
          {!isMobile && (
            <button
              className="manager-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-expanded={sidebarOpen}
            >
              <span className={`manager-toggle-icon ${sidebarOpen ? 'is-rotated' : ''}`}>
                <ChevronRight />
              </span>
            </button>
          )}
          {isMobile && (
            <button
              className="manager-close-btn"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
            >
              <X />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="manager-nav" aria-label="Main navigation">
          <ul className="manager-nav-list" role="tablist">
            {navItems.map((item) => (
              <li key={item.id} role="presentation">
                <button
                  role="tab"
                  aria-selected={activeSection === item.id}
                  id={`nav-${item.id}`}
                  aria-controls={`section-${item.id}`}
                  className={`manager-nav-item ${activeSection === item.id ? 'active' : ''}`}
                  onClick={() => handleNavClick(item.id)}
                >
                  <span className="manager-nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="manager-nav-label">{item.label}</span>
                  {activeSection === item.id && <span className="manager-active-indicator" />}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  )
}

// Icon components for Manager navigation
export const ManagerIcons = {
  Overview: () => (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  Interns: () => (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Supervisors: () => (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  ),
  Departments: () => (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="6" rx="1" />
      <rect x="4" y="14" width="6" height="6" rx="1" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </svg>
  ),
  BarChart: () => (
    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
}

// Export individual icon components
export const { Overview: ManagerOverview, Interns, Supervisors, Departments, BarChart: ManagerBarChart } = ManagerIcons

// Helper to get default nav items
export function getManagerNavItems(): NavItem[] {
  return [
    { id: 'overview', label: 'Overview', icon: <ManagerOverview /> },
    { id: 'interns', label: 'Interns', icon: <Interns /> },
    { id: 'supervisors', label: 'Supervisors', icon: <Supervisors /> },
    { id: 'departments', label: 'Departments', icon: <Departments /> },
    { id: 'biPanel', label: 'BI Panel', icon: <ManagerBarChart /> },
  ]
}

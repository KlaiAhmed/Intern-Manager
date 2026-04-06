import { useState, useEffect, type ReactNode } from 'react'

interface NavItem {
  id: string
  label: string
  icon: string
  badge?: number
}

interface DashboardLayoutProps {
  title: string
  subtitle?: string
  navItems: NavItem[]
  activeTab: string
  onTabChange: (tabId: string) => void
  children: ReactNode
  headerActions?: ReactNode
  onRefresh?: () => void
}

/**
 * DashboardLayout — Main structural wrapper for dashboard views
 * Features a collapsible sidebar, responsive design, and smooth animations
 */
export function DashboardLayout({
  title,
  subtitle,
  navItems,
  activeTab,
  onTabChange,
  children,
  headerActions,
  onRefresh,
}: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Handle responsive breakpoints
  useEffect(() => {
    const checkBreakpoint = () => {
      const width = window.innerWidth
      setIsMobile(width < 640)

      // Auto-collapse sidebar on smaller screens
      if (width < 1024) {
        setSidebarOpen(false)
      } else {
        setSidebarOpen(true)
      }
    }

    checkBreakpoint()
    window.addEventListener('resize', checkBreakpoint)
    return () => window.removeEventListener('resize', checkBreakpoint)
  }, [])

  const handleNavClick = (itemId: string) => {
    onTabChange(itemId)
    if (isMobile) {
      setSidebarOpen(false)
    }
  }

  // Simple icon renderer using unicode symbols
  const renderIcon = (icon: string) => {
    const icons: Record<string, string> = {
      overview: '◆',
      interns: '●',
      supervisors: '■',
      departments: '▲',
      settings: '○',
      reports: '◇',
      home: '⌂',
      users: '‖',
      activity: '⟳',
    }
    return icons[icon] || '•'
  }

  return (
    <div className="dash-layout" data-sidebar-open={sidebarOpen} data-mobile={isMobile}>
      {/* Mobile menu overlay */}
      {isMobile && sidebarOpen && (
        <button
          className="dash-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
        />
      )}

      {/* Sidebar Navigation */}
      <aside className="dash-sidebar" role="navigation" aria-label="Dashboard navigation">
        <div className="dash-sidebar-header">
          {sidebarOpen && (
            <span className="dash-sidebar-title">Dashboard</span>
          )}
          <button
            className="dash-sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={sidebarOpen}
          >
            {sidebarOpen ? '‹' : '›'}
          </button>
        </div>

        <nav className="dash-nav" aria-label="Dashboard tabs">
          <ul className="dash-nav-list" role="tablist">
            {navItems.map((item) => (
              <li key={item.id} role="presentation">
                <button
                  role="tab"
                  aria-selected={activeTab === item.id}
                  aria-controls={`tabpanel-${item.id}`}
                  id={`tab-${item.id}`}
                  className={`dash-nav-item ${activeTab === item.id ? 'dash-nav-item-active' : ''}`}
                  onClick={() => handleNavClick(item.id)}
                >
                  <span className="dash-nav-icon" aria-hidden="true">
                    {renderIcon(item.icon)}
                  </span>
                  <span className="dash-nav-label">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="dash-nav-badge">{item.badge}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Mobile header with hamburger */}
      {isMobile && (
        <header className="dash-mobile-header">
          <button
            className="dash-mobile-menu-button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            ☰
          </button>
          <span className="dash-mobile-title">{title}</span>
          {onRefresh && (
            <button
              className="dash-mobile-refresh"
              onClick={onRefresh}
              aria-label="Refresh"
            >
              ⟳
            </button>
          )}
        </header>
      )}

      {/* Main Content */}
      <main
        id="main-content"
        className="dash-main"
        tabIndex={-1}
      >
        {/* Desktop Header */}
        {!isMobile && (
          <header className="dash-header">
            <div className="dash-header-content">
              <div className="dash-header-text">
                <h1 className="dash-header-title">{title}</h1>
                {subtitle && <p className="dash-header-subtitle">{subtitle}</p>}
              </div>
              {headerActions && (
                <div className="dash-header-actions">
                  {headerActions}
                </div>
              )}
            </div>
          </header>
        )}

        {/* Content Area */}
        <div className="dash-content">
          {children}
        </div>
      </main>
    </div>
  )
}

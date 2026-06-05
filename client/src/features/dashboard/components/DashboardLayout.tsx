import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useI18n } from '../../../locales/I18nContext'
import { ChevronRight, Menu, RefreshCw } from './IconComponents'

interface NavItem {
  id: string
  label: string
  icon: ReactNode
  badge?: number
  badgeLabel?: string
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
  brandLabel?: string
  className?: string
  contentClassName?: string
  navigationLabel?: string
}

export function DashboardLayout({
  title,
  subtitle,
  navItems,
  activeTab,
  onTabChange,
  children,
  headerActions,
  onRefresh,
  brandLabel,
  className = '',
  contentClassName = '',
  navigationLabel,
}: DashboardLayoutProps) {
  const { t, isRtl } = useI18n()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const navButtonRefs = useRef<Array<HTMLButtonElement | null>>([])

  useEffect(() => {
    const checkBreakpoint = () => {
      setIsMobile(window.innerWidth < 640)
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

  const focusNavItem = (index: number) => {
    const nextItem = navItems[index]
    const nextButton = navButtonRefs.current[index]

    if (!nextItem || !nextButton) {
      return
    }

    nextButton.focus()
    onTabChange(nextItem.id)
  }

  const handleNavKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (navItems.length === 0) {
      return
    }

    const forwardKey = isRtl ? 'ArrowLeft' : 'ArrowRight'
    const backwardKey = isRtl ? 'ArrowRight' : 'ArrowLeft'

    switch (event.key) {
      case 'ArrowDown':
      case forwardKey:
        event.preventDefault()
        focusNavItem((index + 1) % navItems.length)
        break
      case 'ArrowUp':
      case backwardKey:
        event.preventDefault()
        focusNavItem((index - 1 + navItems.length) % navItems.length)
        break
      case 'Home':
        event.preventDefault()
        focusNavItem(0)
        break
      case 'End':
        event.preventDefault()
        focusNavItem(navItems.length - 1)
        break
      default:
        break
    }
  }

  return (
    <div className={`dash-layout ${className}`.trim()} data-sidebar-open={sidebarOpen} data-mobile={isMobile}>
      {isMobile && sidebarOpen && (
        <button
          className="dash-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-label={t('dashboard.sidebar.closeMenu')}
        />
      )}

      <aside className="dash-sidebar" role="navigation" aria-label={navigationLabel ?? t('dashboard.sidebar.dashboardNav')}>
        <div className="dash-sidebar-header">
          {sidebarOpen && (
            <span className="dash-sidebar-title">{brandLabel ?? t('dashboard.sidebar.brand')}</span>
          )}
          <button
            type="button"
            className="dash-sidebar-toggle"
            onClick={() => setSidebarOpen((currentValue) => !currentValue)}
            aria-label={sidebarOpen ? t('dashboard.sidebar.collapseSidebar') : t('dashboard.sidebar.expandSidebar')}
            aria-expanded={sidebarOpen}
          >
            <span className="dash-sidebar-toggle-icon" aria-hidden="true">
              <ChevronRight />
            </span>
          </button>
        </div>

        <nav className="dash-nav" aria-label={t('dashboard.sidebar.dashboardTabs')}>
          <ul className="dash-nav-list" role="tablist">
            {navItems.map((item, index) => (
              <li key={item.id} role="presentation">
                <button
                  ref={(node) => {
                    navButtonRefs.current[index] = node
                  }}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === item.id}
                  aria-controls={`tabpanel-${item.id}`}
                  id={`tab-${item.id}`}
                  tabIndex={activeTab === item.id ? 0 : -1}
                  className={`dash-nav-item ${activeTab === item.id ? 'dash-nav-item-active' : ''}`}
                  onClick={() => handleNavClick(item.id)}
                  onKeyDown={(event) => handleNavKeyDown(event, index)}
                >
                  <span className="dash-nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="dash-nav-label">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="dash-nav-badge" aria-label={item.badgeLabel}>
                      {item.badge}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {isMobile && (
        <header className="dash-mobile-header">
          <button
            type="button"
            className="dash-mobile-menu-button"
            onClick={() => setSidebarOpen(true)}
            aria-label={t('dashboard.sidebar.openMenu')}
          >
            <Menu />
          </button>
          <span className="dash-mobile-title">{title}</span>
          {onRefresh && (
            <button
              type="button"
              className="dash-mobile-refresh"
              onClick={onRefresh}
              aria-label={t('dashboard.action.refresh')}
            >
              <RefreshCw />
            </button>
          )}
        </header>
      )}

      <main id="main-content" className="dash-main" tabIndex={-1}>
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

        <div className={`dash-content ${contentClassName}`.trim()}>
          {children}
        </div>
      </main>
    </div>
  )
}

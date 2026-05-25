import type { ReactNode } from 'react'
import {
  SuperAdminSidebar,
  type SettingsSubSection,
  type SuperAdminSection,
} from '../../components/SuperAdminSidebar'
import styles from './DashboardShell.module.css'

interface DashboardShellProps {
  activeSection: SuperAdminSection
  onSectionChange: (section: SuperAdminSection) => void
  onSettingsSubSectionChange?: (subsection: SettingsSubSection) => void
  hideAdminManagement?: boolean
  brandLabel?: string
  shellClassName?: string
  contentKey: string
  children: ReactNode
}

export function DashboardShell({
  activeSection,
  onSectionChange,
  onSettingsSubSectionChange,
  hideAdminManagement,
  brandLabel,
  shellClassName,
  contentKey,
  children,
}: DashboardShellProps) {
  return (
    <div className={`${styles.root} super-admin-dashboard ${shellClassName ?? ''}`.trim()}>
      <SuperAdminSidebar
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        onSettingsSubSectionChange={onSettingsSubSectionChange}
        hideAdminManagement={hideAdminManagement}
        brandLabel={brandLabel}
      />

      <main className="super-admin-main" id="main-content">
        <div className="super-admin-content-wrapper">
          <div className="content-fade-in" key={contentKey}>{children}</div>
        </div>
      </main>
    </div>
  )
}

import { useEffect, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { DashboardButton } from '../components/DashboardButton'
import { DashboardLayout } from '../components/DashboardLayout'
import { TabErrorBoundary } from '../components/TabErrorBoundary'
import {
  PendingStatusView,
  StatusGateLoading,
} from '../components/intern/InternStatusViews'
import { MultiStepApplicationForm } from '../components/intern/MultiStepApplicationForm'
import { useInternDashboard } from '../hooks/intern/useInternDashboard'
import { internDashboardQueryKeys } from '../hooks/intern/internDashboardQueryKeys'
import { useMissionFeatureFlags } from '../hooks/intern/useMissionFeatureFlags'
import type { InternDashboardTabId } from '../types/internDashboard'
import type { DashboardCard } from '../types/missionFeatureFlags'
import { DeliverablesTab } from '../tabs/intern/DeliverablesTab'
import { EvaluationsTab } from '../tabs/intern/EvaluationsTab'
import { JournalTab } from '../tabs/intern/JournalTab'
import { MeetingsTab } from '../tabs/intern/MeetingsTab'
import { MissionTab } from '../tabs/intern/MissionTab'
import { OverviewTab } from '../tabs/intern/OverviewTab'
import { ProfileTab } from '../tabs/intern/ProfileTab'
import {
  getFirstVisibleInternTab,
  getInternTabVisibility,
  getVisibleInternTabs,
  internDashboardTabDefinitions,
} from '../tabs/intern/internDashboardTabs'
import '../styles/pages/InternDashboard.css'

function isInternDashboardTabId(value: string): value is InternDashboardTabId {
  return internDashboardTabDefinitions.some((tab) => tab.id === value)
}

export function InternDashboard() {
  const queryClient = useQueryClient()
  const {
    t,
    user,
    activeTab,
    setActiveTab,
    internship,
    loadingInternship,
    internshipError,
    unreadNotificationCount,
    internLifecycleStatus,
    pendingNotificationMessage,
    pendingProfile,
    statusLoading,
    statusError,
    loadInternLifecycleStatus,
    loadInternship,
    getFirstName,
  } = useInternDashboard()


  const missionIdForFlags = internLifecycleStatus === 'ACTIVE' ? internship?.id ?? null : null
  const {
    flags: missionFlags,
    isLoading: flagsLoading,
    error: flagsError,
  } = useMissionFeatureFlags(missionIdForFlags)

  const tabVisibility = useMemo(() => getInternTabVisibility(missionFlags), [missionFlags])
  const visibleTabs = useMemo(() => getVisibleInternTabs(tabVisibility), [tabVisibility])

  useEffect(() => {
    if (!isInternDashboardTabId(activeTab) || !tabVisibility[activeTab]) {
      setActiveTab(getFirstVisibleInternTab(tabVisibility))
    }
  }, [activeTab, setActiveTab, tabVisibility])

  const isCardReadOnly = (card: DashboardCard) => Boolean(missionFlags?.[card] && !missionFlags[card].isInteractive)
  const isCardVisible = (card: DashboardCard) => missionFlags?.[card]?.isVisible ?? true

  const navItems = visibleTabs.map((tab) => ({
    id: tab.id,
    label: t(tab.labelKey),
    icon: tab.icon,
    badge: tab.id === 'overview' ? unreadNotificationCount : undefined,
    badgeLabel: t('dashboard.intern.sidebar.unreadNotifications', { count: unreadNotificationCount }),
  }))

  const handleTabChange = (tabId: string) => {
    if (isInternDashboardTabId(tabId)) {
      setActiveTab(tabId)
    }
  }

  const userId = user?.id

  const handleOnboardingSubmitted = useCallback(async () => {
    if (userId) {
      await queryClient.invalidateQueries({ queryKey: internDashboardQueryKeys.status(userId) })
    }
  }, [queryClient, userId])

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <OverviewTab
            internship={internship}
            loadingInternship={loadingInternship}
            internshipError={internshipError}
            visibility={tabVisibility}
            onRetryInternship={() => { void loadInternship() }}
            t={t}
          />
        )
      case 'deliverables':
        return (
          <DeliverablesTab
            tasksVisible={isCardVisible('tasks')}
            deliverablesVisible={isCardVisible('deliverables')}
            tasksReadOnly={isCardReadOnly('tasks')}
            deliverablesReadOnly={isCardReadOnly('deliverables')}
            t={t}
          />
        )
      case 'mission':
        return (
          <MissionTab
            internship={internship}
            loading={loadingInternship}
            error={internshipError}
            missionFlags={missionFlags}
            flagsLoading={flagsLoading}
            flagsError={flagsError}
            onRetry={() => { void loadInternship() }}
            t={t}
          />
        )
      case 'journal':
        return <JournalTab isReadOnly={isCardReadOnly('journal')} t={t} />
      case 'evaluations':
        return <EvaluationsTab t={t} />
      case 'meetings':
        return <MeetingsTab t={t} />
      case 'profile':
        return <ProfileTab t={t} />
      default:
        return null
    }
  }

  if (statusLoading) {
    return <StatusGateLoading />
  }

  if (statusError) {
    return (
      <div className="intern-dashboard status-gate-page">
        <div className="status-gate-card">
          <h1 className="status-gate-title">{t('dashboard.internDashboard.unableLoadStatus')}</h1>
          <p className="status-gate-subtitle">{statusError}</p>
          <button className="error-retry-btn" onClick={() => { void loadInternLifecycleStatus() }}>{t('dashboard.internDashboard.retry')}</button>
        </div>
      </div>
    )
  }

  if (!user?.id) {
    return (
      <div className="intern-dashboard status-gate-page">
        <div className="status-gate-card">
          <h1 className="status-gate-title">{t('dashboard.internDashboard.unableLoadProfile')}</h1>
        </div>
      </div>
    )
  }

  if (internLifecycleStatus === 'INCOMPLETE') {
    return (
      <MultiStepApplicationForm
        onSubmitted={handleOnboardingSubmitted}
      />
    )
  }

  if (internLifecycleStatus === 'PENDING') {
    return <PendingStatusView notificationMessage={pendingNotificationMessage} profile={pendingProfile} />
  }

  if (internLifecycleStatus !== 'ACTIVE') {
    return (
      <div className="intern-dashboard status-gate-page">
        <div className="status-gate-card">
          <h1 className="status-gate-title">{t('dashboard.internDashboard.internshipStatus', { status: internLifecycleStatus ?? '-' })}</h1>
          <p className="status-gate-subtitle">{t('dashboard.internDashboard.readOnly')}</p>
        </div>
      </div>
    )
  }

  return (
    <DashboardLayout
      title={t('dashboard.intern.redesign.header.title')}
      subtitle={t('dashboard.intern.redesign.header.subtitle', { name: getFirstName() || '' })}
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      onRefresh={() => { void loadInternship() }}
      brandLabel={t('dashboard.intern.sidebar.brand')}
      navigationLabel={t('dashboard.intern.sidebar.navigation')}
      className="intern-dashboard-shell"
      contentClassName="intern-dashboard-content"
      headerActions={(
        <DashboardButton variant="secondary" size="sm" onClick={() => { void loadInternship() }}>
          {t('dashboard.action.refresh')}
        </DashboardButton>
      )}
    >
      <section
        key={activeTab}
        className="intern-tab-panel"
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
      >
        <TabErrorBoundary key={activeTab} resetKeys={[activeTab]}>
          {renderActiveTab()}
        </TabErrorBoundary>
      </section>
    </DashboardLayout>
  )
}

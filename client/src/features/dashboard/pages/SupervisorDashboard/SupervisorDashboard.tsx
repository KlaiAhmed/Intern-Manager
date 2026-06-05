import { useEffect, useMemo, useState } from 'react'
import { matchPath, useLocation } from 'react-router-dom'

import { DashboardLayout } from '../../components/DashboardLayout'
import { Briefcase, BookOpen, ClipboardCheck, FileCheck, Overview } from '../../components/IconComponents'
import { Skeleton } from '../../components/Skeleton'
import { TabErrorBoundary } from '../../components/TabErrorBoundary'
import { useDashboardBadges } from '../../hooks/supervisor/useDashboardBadges'
import { useSupervisorMissions } from '../../hooks/supervisor/useSupervisorMissions'
import { DeliverablesTab } from '../../tabs/supervisor/DeliverablesTab/DeliverablesTab'
import { MeetingsTab } from '../../tabs/supervisor/MeetingsTab/MeetingsTab'
import { MissionTab } from '../../tabs/supervisor/MissionTab/MissionTab'
import { OverviewTab } from '../../tabs/supervisor/OverviewTab/OverviewTab'
import { TasksTab } from '../../tabs/supervisor/TasksTab/TasksTab'
import type { MissionStatus, SupervisorMission } from '../../types/supervisorDashboard'
import { useI18n } from '../../../../locales/I18nContext'

import { SupervisorJournalReviewPage } from './SupervisorJournalReviewPage'
import '../../styles/pages/SupervisorDashboard.css'

const groupedMissionStatuses = ['active', 'paused', 'completed'] as const
const excludedGroupedStatuses: MissionStatus[] = ['archived', 'cancelled']
const ACTIVE_MISSION_STORAGE_KEY = 'supervisor-dashboard:active-mission-id'

function readPersistedMissionId(): string | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const stored = window.localStorage.getItem(ACTIVE_MISSION_STORAGE_KEY)
    return stored && stored.trim().length > 0 ? stored : null
  } catch {
    return null
  }
}

function persistMissionId(missionId: string | null) {
  if (typeof window === 'undefined') {
    return
  }
  try {
    if (missionId) {
      window.localStorage.setItem(ACTIVE_MISSION_STORAGE_KEY, missionId)
    } else {
      window.localStorage.removeItem(ACTIVE_MISSION_STORAGE_KEY)
    }
  } catch {
    // Storage may be unavailable (private mode, quota); ignore silently.
  }
}

function SupervisorDashboardLoading() {
  return (
    <main className="supervisor-dashboard supervisor-dashboard-loading" id="main-content" tabIndex={-1}>
      <aside className="supervisor-dashboard-loading__sidebar" aria-hidden="true">
        <Skeleton height="2.5rem" />
        <Skeleton height="2.75rem" />
        <Skeleton height="2.75rem" />
        <Skeleton height="2.75rem" />
        <Skeleton height="2.75rem" />
        <Skeleton height="2.75rem" />
      </aside>
      <section className="supervisor-dashboard-loading__main" aria-hidden="true">
        <div className="supervisor-dashboard-loading__header">
          <div>
            <Skeleton width="16rem" height="2rem" />
            <Skeleton width="24rem" height="1rem" />
          </div>
          <Skeleton width="16rem" height="2.75rem" />
        </div>
        <Skeleton height="12rem" />
        <Skeleton height="22rem" />
      </section>
    </main>
  )
}

function getMissionLabel(mission: SupervisorMission): string {
  return mission.title.trim() || mission.id
}

function SupervisorDashboardShell() {
  const { t } = useI18n()
  const [activeMissionId, setActiveMissionId] = useState<string | null>(() => readPersistedMissionId())
  const [activeTab, setActiveTab] = useState<string>('overview')
  const {
    missions,
    isLoading: missionsLoading,
    refresh: refreshMissions,
  } = useSupervisorMissions()
  const badges = useDashboardBadges(activeMissionId)

  useEffect(() => {
    // Only reconcile once missions have actually loaded; reconciling against the
    // empty placeholder list would wrongly evict the persisted selection.
    if (missionsLoading) {
      return
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveMissionId((currentMissionId) => {
      // Persisted selection is still valid — keep it.
      if (currentMissionId && missions.some((mission) => mission.id === currentMissionId)) {
        return currentMissionId
      }

      // No persisted selection (first visit, or storage was cleared) — pick a
      // sensible default and remember it so subsequent refreshes stay stable.
      if (!currentMissionId) {
        const fallback =
          missions.find((mission) => mission.status === 'active')?.id ??
          missions[0]?.id ??
          null
        if (fallback) {
          persistMissionId(fallback)
        }
        return fallback
      }

      // Persisted selection is no longer in the fetched list (e.g. the mission
      // was archived or the supervisor temporarily lost access). Do NOT clear
      // localStorage or substitute a different mission: the next successful
      // fetch may bring the mission back, and we must never silently destroy
      // the user's last explicit choice. The select will render with no
      // matching option, prompting the user to re-pick.
      return currentMissionId
    })
  }, [missions, missionsLoading])

  const handleMissionChange = (missionId: string) => {
    setActiveMissionId(missionId)
    // Persist only on explicit user action. Auto-fallbacks must not overwrite
    // the user's saved preference, otherwise it would be lost across refreshes.
    persistMissionId(missionId)
  }

  const activeMission = useMemo(
    () => missions.find((mission) => mission.id === activeMissionId) ?? null,
    [activeMissionId, missions],
  )

  const navItems = [
    { id: 'overview', label: t('dashboard.supervisor.tabs.overview'), icon: <Overview /> },
    { id: 'mission', label: t('dashboard.supervisor.tabs.mission'), icon: <Briefcase /> },
    {
      id: 'deliverables',
      label: t('dashboard.supervisor.tabs.deliverables'),
      icon: <FileCheck />,
      badge: badges.pendingReviewCount > 0 ? badges.pendingReviewCount : undefined,
    },
    {
      id: 'tasks',
      label: t('dashboard.supervisor.tabs.tasks'),
      icon: <ClipboardCheck />,
      badge: badges.overdueTaskCount > 0 ? badges.overdueTaskCount : undefined,
    },
    {
      id: 'meetings',
      label: t('dashboard.supervisor.tabs.meetings'),
      icon: <BookOpen />,
      badge: badges.todayMeetingCount > 0 ? badges.todayMeetingCount : undefined,
    },
  ]

  const renderMissionOptions = () => {
    if (missions.length <= 5) {
      return missions.map((mission) => (
        <option key={mission.id} value={mission.id}>
          {getMissionLabel(mission)}
        </option>
      ))
    }

    const groupedStatuses = new Set<MissionStatus>(groupedMissionStatuses)
    const excludedStatuses = new Set<MissionStatus>(excludedGroupedStatuses)
    const otherMissions = missions.filter(
      (mission) => !groupedStatuses.has(mission.status) && !excludedStatuses.has(mission.status),
    )

    return (
      <>
        {groupedMissionStatuses.map((status) => {
          const statusMissions = missions.filter((mission) => mission.status === status)

          if (statusMissions.length === 0) {
            return null
          }

          return (
            <optgroup key={status} label={t(`dashboard.supervisor.status.${status}`)}>
              {statusMissions.map((mission) => (
                <option key={mission.id} value={mission.id}>
                  {getMissionLabel(mission)}
                </option>
              ))}
            </optgroup>
          )
        })}
        {otherMissions.length > 0 && (
          <optgroup label={t('dashboard.supervisor.status.draft')}>
            {otherMissions.map((mission) => (
              <option key={mission.id} value={mission.id}>
                {getMissionLabel(mission)}
              </option>
            ))}
          </optgroup>
        )}
      </>
    )
  }

  const renderActiveTab = () => {
    if (activeMissionId === null) {
      return null
    }

    switch (activeTab) {
      case 'overview':
        return <OverviewTab missionId={activeMissionId} onTabChange={setActiveTab} />
      case 'mission':
        return <MissionTab missionId={activeMissionId} />
      case 'deliverables':
        return <DeliverablesTab missionId={activeMissionId} />
      case 'tasks':
        return <TasksTab missionId={activeMissionId} />
      case 'meetings':
        return <MeetingsTab />
      default:
        return null
    }
  }

  if (missionsLoading) {
    return <SupervisorDashboardLoading />
  }

  if (missions.length === 0) {
    return (
      <main className="supervisor-dashboard supervisor-dashboard-empty-page" id="main-content" tabIndex={-1}>
        <section className="dash-empty supervisor-dashboard-empty-panel">
          <h1 className="dash-empty-title">{t('dashboard.supervisor.empty.title')}</h1>
          <p className="dash-empty-description">{t('dashboard.supervisor.empty.noMissions')}</p>
        </section>
      </main>
    )
  }

  if (activeMissionId === null) {
    return <SupervisorDashboardLoading />
  }

  return (
    <DashboardLayout
      title={t('dashboard.supervisor.title')}
      subtitle={activeMission ? getMissionLabel(activeMission) : undefined}
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onRefresh={() => {
        void Promise.all([refreshMissions(), badges.refresh()])
      }}
      brandLabel={t('dashboard.supervisor.title')}
      navigationLabel={t('dashboard.sidebar.dashboardNav')}
      className="supervisor-dashboard"
      contentClassName="supervisor-dashboard__content"
      headerActions={(
        <select
          className="supervisor-dashboard__mission-select"
          value={activeMissionId}
          onChange={(event) => handleMissionChange(event.target.value)}
          aria-label={t('dashboard.supervisor.missions')}
        >
          {renderMissionOptions()}
        </select>
      )}
    >
      <section
        key={`${activeTab}-${activeMissionId}`}
        className="supervisor-dashboard__tab-panel"
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={0}
      >
        <TabErrorBoundary resetKeys={[activeTab, activeMissionId]}>
          {renderActiveTab()}
        </TabErrorBoundary>
      </section>
    </DashboardLayout>
  )
}

export function SupervisorDashboard() {
  const location = useLocation()
  const isJournalReviewRoute = Boolean(
    matchPath('/dashboard/supervisor/interns/:internId/journal', location.pathname),
  )

  if (isJournalReviewRoute) {
    return <SupervisorJournalReviewPage />
  }

  return <SupervisorDashboardShell />
}

import { Suspense, lazy, useCallback } from 'react'
import { DashboardButton } from '../../components/DashboardButton'
import { DashboardLayout } from '../../components/DashboardLayout'
import type { ManagerTabId } from './types'
import { useManagerDashboardState } from './useManagerDashboardState'
import '../../styles/pages/ManagerDashboard.css'

// Lazy-load tab components - only loaded when tab is active
const DepartmentsTab = lazy(() =>
  import('./DepartmentsTab').then((m) => ({ default: m.DepartmentsTab })),
)
const InternsTab = lazy(() =>
  import('./InternsTab').then((m) => ({ default: m.InternsTab })),
)
const OverviewTab = lazy(() =>
  import('./OverviewTab').then((m) => ({ default: m.OverviewTab })),
)
const SupervisorsTab = lazy(() =>
  import('./SupervisorsTab').then((m) => ({ default: m.SupervisorsTab })),
)
// Lazy-load modal - only loaded when opened
const InternDetailsModal = lazy(() =>
  import('./InternDetailsModal').then((m) => ({ default: m.InternDetailsModal })),
)

function TabLoadingFallback() {
  return (
    <div className="tab-loading">
      <div className="tab-loading-spinner" />
    </div>
  )
}

export function ManagerDashboard() {
  const state = useManagerDashboardState()

  const {
    activeTab,
    setActiveTab,
    navItems,
    refreshAll,
    loadingKPIs,
    loadingDepartments,
    loadingActivity,
    kpisError,
    departmentsError,
    activityError,
    internsCount,
    activeMissionsCount,
    avgCompletion,
    pendingReviews,
    departments,
    activities,
    loadKPIs,
    loadDepartments,
    loadActivity,
    getActivityIcon,
    formatActivityDate,
    loadingInterns,
    internsError,
    filteredInterns,
    selectedDepartment,
    setSelectedDepartment,
    selectedVerificationStatus,
    setSelectedVerificationStatus,
    internsSearch,
    setInternsSearch,
    departmentOptions,
    verificationStatusOptions,
    getInitials,
    openInternModal,
    loadInterns,
    loadingSupervisors,
    supervisorsError,
    supervisors,
    loadSupervisors,
    selectedIntern,
    isInternModalOpen,
    closeInternModal,
  } = state

  const renderTabContent = useCallback(() => {
    switch (activeTab) {
      case 'overview':
        return (
          <OverviewTab
            loadingKPIs={loadingKPIs}
            loadingDepartments={loadingDepartments}
            loadingActivity={loadingActivity}
            kpisError={kpisError}
            departmentsError={departmentsError}
            activityError={activityError}
            internsCount={internsCount}
            activeMissionsCount={activeMissionsCount}
            avgCompletion={avgCompletion}
            pendingReviews={pendingReviews}
            departments={departments}
            activities={activities}
            loadKPIs={loadKPIs}
            loadDepartments={loadDepartments}
            loadActivity={loadActivity}
            getActivityIcon={getActivityIcon}
            formatActivityDate={formatActivityDate}
          />
        )
      case 'interns':
        return (
          <InternsTab
            loadingInterns={loadingInterns}
            internsError={internsError}
            filteredInterns={filteredInterns}
            selectedDepartment={selectedDepartment}
            setSelectedDepartment={setSelectedDepartment}
            selectedVerificationStatus={selectedVerificationStatus}
            setSelectedVerificationStatus={setSelectedVerificationStatus}
            internsSearch={internsSearch}
            setInternsSearch={setInternsSearch}
            departmentOptions={departmentOptions}
            verificationStatusOptions={verificationStatusOptions}
            loadingDepartments={loadingDepartments}
            departmentsError={departmentsError}
            getInitials={getInitials}
            openInternModal={openInternModal}
            loadInterns={loadInterns}
          />
        )
      case 'supervisors':
        return (
          <SupervisorsTab
            loadingSupervisors={loadingSupervisors}
            supervisorsError={supervisorsError}
            supervisors={supervisors}
            getInitials={getInitials}
            loadSupervisors={loadSupervisors}
          />
        )
      case 'departments':
        return (
          <DepartmentsTab
            loadingDepartments={loadingDepartments}
            departmentsError={departmentsError}
            departments={departments}
            loadDepartments={loadDepartments}
          />
        )
      default:
        return null
    }
  }, [
    activeTab,
    loadingKPIs,
    loadingDepartments,
    loadingActivity,
    kpisError,
    departmentsError,
    activityError,
    internsCount,
    activeMissionsCount,
    avgCompletion,
    pendingReviews,
    departments,
    activities,
    loadKPIs,
    loadDepartments,
    loadActivity,
    getActivityIcon,
    formatActivityDate,
    loadingInterns,
    internsError,
    filteredInterns,
    selectedDepartment,
    setSelectedDepartment,
    selectedVerificationStatus,
    setSelectedVerificationStatus,
    internsSearch,
    setInternsSearch,
    departmentOptions,
    verificationStatusOptions,
    getInitials,
    openInternModal,
    loadInterns,
    loadingSupervisors,
    supervisorsError,
    supervisors,
    loadSupervisors,
  ])

  return (
    <DashboardLayout
      title="Manager Dashboard"
      subtitle="Overview of internship program across departments"
      navItems={navItems}
      activeTab={activeTab}
      onTabChange={(tabId) => setActiveTab(tabId as ManagerTabId)}
      onRefresh={refreshAll}
      headerActions={
        <DashboardButton variant="secondary" size="sm" onClick={refreshAll}>
          Refresh
        </DashboardButton>
      }
    >
      <Suspense fallback={<TabLoadingFallback />}>{renderTabContent()}</Suspense>

      {isInternModalOpen && (
        <Suspense fallback={null}>
          <InternDetailsModal
            isOpen={isInternModalOpen}
            intern={selectedIntern}
            onClose={closeInternModal}
            getInitials={getInitials}
            departments={departments}
            loadingDepartments={loadingDepartments}
            departmentsError={departmentsError}
            onAssignmentSuccess={loadInterns}
          />
        </Suspense>
      )}
    </DashboardLayout>
  )
}

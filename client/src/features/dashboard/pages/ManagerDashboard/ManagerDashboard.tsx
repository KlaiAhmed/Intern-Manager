import { DashboardButton } from '../../components/DashboardButton'
import { DashboardLayout } from '../../components/DashboardLayout'
import { DepartmentsTab } from './DepartmentsTab'
import { InternDetailsModal } from './InternDetailsModal'
import { InternsTab } from './InternsTab'
import { OverviewTab } from './OverviewTab'
import { SupervisorsTab } from './SupervisorsTab'
import type { ManagerTabId } from './types'
import { useManagerDashboardState } from './useManagerDashboardState'
import '../../styles/pages/ManagerDashboard.css'

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
    internsSearch,
    setInternsSearch,
    departmentOptions,
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
      {activeTab === 'overview' && (
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
      )}

      {activeTab === 'interns' && (
        <InternsTab
          loadingInterns={loadingInterns}
          internsError={internsError}
          filteredInterns={filteredInterns}
          selectedDepartment={selectedDepartment}
          setSelectedDepartment={setSelectedDepartment}
          internsSearch={internsSearch}
          setInternsSearch={setInternsSearch}
          departmentOptions={departmentOptions}
          getInitials={getInitials}
          openInternModal={openInternModal}
          loadInterns={loadInterns}
        />
      )}

      {activeTab === 'supervisors' && (
        <SupervisorsTab
          loadingSupervisors={loadingSupervisors}
          supervisorsError={supervisorsError}
          supervisors={supervisors}
          getInitials={getInitials}
          loadSupervisors={loadSupervisors}
        />
      )}

      {activeTab === 'departments' && (
        <DepartmentsTab
          loadingDepartments={loadingDepartments}
          departmentsError={departmentsError}
          departments={departments}
          loadDepartments={loadDepartments}
        />
      )}

      <InternDetailsModal
        isOpen={isInternModalOpen}
        intern={selectedIntern}
        onClose={closeInternModal}
        getInitials={getInitials}
      />
    </DashboardLayout>
  )
}

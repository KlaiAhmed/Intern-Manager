export { DashboardPage } from './pages/DashboardPage'
export { InternDashboard } from './pages/InternDashboard'
export { useInternDashboard } from './hooks/intern/useInternDashboard'
export {
	IncompleteStatusView,
	PendingStatusView,
	StatusGateLoading,
} from './components/intern/InternStatusViews'
export { TabErrorBoundary } from './components/TabErrorBoundary'
export { TabErrorFallback } from './components/TabErrorFallback'
export { uploadInternCvWithProgress } from './api/internCvApi'
export { internDashboardApi } from './api/internDashboardApi'
export { uploadWithProgress } from '../../lib/uploadWithProgress'
export {
	useInternDeliverables,
	useInternDeliverableVersions,
	useInternEvaluations,
	useInternJournal,
	useInternLifecycleStatus,
	useInternMeetings,
	useInternMission,
	useInternMissionFeatureFlags,
	useInternNotifications,
	useInternProfile,
	useInternTasks,
} from './hooks/intern'
export type {
	CvUploadResponse,
	Deliverable,
	DeliverableVersion,
	DeliverableVersionHistory,
	Evaluation,
	InternDashboardTabId,
	InternDashboardTabVisibility,
	InternLifecycleStatus,
	InternProfileReadOnly,
	Internship,
	InternStatusResponse,
	JournalEntry,
	Meeting,
	NotificationItem,
	PendingInternProfile,
	Task,
	TranslateFn,
} from './types/internDashboard'
export type {
	InternDashboardTab,
	InternTabVisibility,
	InternTabVisibilityMap,
} from './types/intern.types'

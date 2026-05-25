// Shared primitives
export interface ChartDataPoint { name: string; value: number; }
export interface TimeSeriesPoint { month: string; [key: string]: number | string; }

// S1
export interface BiKpiResponse {
  totalInterns: number; activeInterns: number; pendingVerifications: number;
  activeMissions: number; totalMissions: number; avgEvaluationScore: number;
  supervisorUtilization: number; onboardingCompletionRate: number;
  pendingDeliverables: number; totalSupervisors: number;
}

// S2
export interface BiInternFunnelResponse {
  funnel: Array<{ stage: string; value: number }>;
  byVerificationStatus: ChartDataPoint[];
  byWorkPreference: ChartDataPoint[];
}

// S3
export interface BiMissionStatsResponse {
  byStatus: ChartDataPoint[];
  byType: ChartDataPoint[];
  timeline: Array<{ month: string; created: number; completed: number; cancelled: number }>;
  completionRateByMonth: Array<{ month: string; rate: number }>;
  avgDurationDays: number;
  totalActive: number;
}

// S4
export interface BiEvaluationStatsResponse {
  avgScores: {
    technical: number; autonomy: number; communication: number;
    deadlineRespect: number; deliverableQuality: number;
  };
  distribution: Array<{ range: string; count: number }>;
  byMonth: Array<{ month: string; avgOverall: number; count: number }>;
  topInterns: Array<{
    internId: string; name: string; avgScore: number; evaluationCount: number;
  }>;
  statusCounts: { pending: number; submitted: number };
}

// S5
export interface BiDemographicsResponse {
  byMajor: ChartDataPoint[];
  byYearOfStudy: ChartDataPoint[];
  byWorkPreference: ChartDataPoint[];
  byUniversity: ChartDataPoint[];
  byDepartment: ChartDataPoint[];
}

// S6
export interface BiSupervisorWorkloadResponse {
  supervisors: Array<{
    id: string; name: string; department: string;
    assignedInterns: number; maxCapacity: number; utilization: number;
  }>;
  overallUtilization: number;
  overCapacityCount: number;
  unassignedInterns: number;
}

// S7
export interface BiDeliverableStatsResponse {
  byStatus: ChartDataPoint[];
  overdueCount: number;
  submissionsByWeek: Array<{
    week: string; submitted: number; accepted: number; rejected: number;
  }>;
  journalActivityByDay: Array<{ date: string; count: number }>;
}

// S8
export interface BiSystemHealthResponse {
  userGrowthByMonth: Array<{
    month: string; interns: number; supervisors: number; admins: number;
    cumulative: number;
  }>;
  activeSessionsCount: number;
  auditLogByDay: Array<{ date: string; count: number }>;
  auditByAction: ChartDataPoint[];
  totalUsers: number;
  usersByRole: ChartDataPoint[];
}

// S9
export interface BiActionQueueResponse {
  pendingVerifications: number;
  pendingEvaluations: number;
  missionsEndingSoon: Array<{
    id: string; title: string; endDate: string; internName: string;
  }>;
  unassignedVerifiedInterns: number;
  overdueDeliverables: number;
  items: Array<{
    type: string; priority: 'high' | 'medium' | 'low';
    message: string; count: number; actionUrl: string;
  }>;
}

// Generic section data wrapper
export interface BiSectionData<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

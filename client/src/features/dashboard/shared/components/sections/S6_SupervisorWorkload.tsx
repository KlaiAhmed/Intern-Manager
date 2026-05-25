import type { BiSectionData, BiSupervisorWorkloadResponse } from '../../types/biDashboard'

interface Props { data: BiSectionData<BiSupervisorWorkloadResponse>; }

export function S6_SupervisorWorkload({ data }: Props) {
  return (
    <div
      style={{ padding: 24, background: '#f5f5f5', borderRadius: 8, marginBottom: 16, color: '#666', fontSize: 14 }}
      aria-busy={data.loading}
    >
      [Section 6 — Supervisor Workload] — pending implementation
    </div>
  )
}

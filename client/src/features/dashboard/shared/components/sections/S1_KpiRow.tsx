import type { BiKpiResponse, BiSectionData } from '../../types/biDashboard'

interface Props { data: BiSectionData<BiKpiResponse>; }

export function S1_KpiRow({ data }: Props) {
  return (
    <div
      style={{ padding: 24, background: '#f5f5f5', borderRadius: 8, marginBottom: 16, color: '#666', fontSize: 14 }}
      aria-busy={data.loading}
    >
      [Section 1 — KPI Row] — pending implementation
    </div>
  )
}

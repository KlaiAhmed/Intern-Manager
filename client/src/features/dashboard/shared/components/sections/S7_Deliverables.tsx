import type { BiDeliverableStatsResponse, BiSectionData } from '../../types/biDashboard'

interface Props { data: BiSectionData<BiDeliverableStatsResponse>; }

export function S7_Deliverables({ data }: Props) {
  return (
    <div
      style={{ padding: 24, background: '#f5f5f5', borderRadius: 8, marginBottom: 16, color: '#666', fontSize: 14 }}
      aria-busy={data.loading}
    >
      [Section 7 — Deliverables] — pending implementation
    </div>
  )
}

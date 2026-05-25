import type { BiEvaluationStatsResponse, BiSectionData } from '../../types/biDashboard'

interface Props { data: BiSectionData<BiEvaluationStatsResponse>; }

export function S4_EvaluationsSection({ data }: Props) {
  return (
    <div
      style={{ padding: 24, background: '#f5f5f5', borderRadius: 8, marginBottom: 16, color: '#666', fontSize: 14 }}
      aria-busy={data.loading}
    >
      [Section 4 — Evaluations] — pending implementation
    </div>
  )
}

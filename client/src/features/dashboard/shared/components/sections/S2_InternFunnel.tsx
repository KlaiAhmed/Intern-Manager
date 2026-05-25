import type { BiInternFunnelResponse, BiSectionData } from '../../types/biDashboard'

interface Props { data: BiSectionData<BiInternFunnelResponse>; }

export function S2_InternFunnel({ data }: Props) {
  return (
    <div
      style={{ padding: 24, background: '#f5f5f5', borderRadius: 8, marginBottom: 16, color: '#666', fontSize: 14 }}
      aria-busy={data.loading}
    >
      [Section 2 — Intern Funnel] — pending implementation
    </div>
  )
}

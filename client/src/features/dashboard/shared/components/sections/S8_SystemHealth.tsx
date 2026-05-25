import type { BiSectionData, BiSystemHealthResponse } from '../../types/biDashboard'

interface Props { data: BiSectionData<BiSystemHealthResponse>; }

export function S8_SystemHealth({ data }: Props) {
  return (
    <div
      style={{ padding: 24, background: '#f5f5f5', borderRadius: 8, marginBottom: 16, color: '#666', fontSize: 14 }}
      aria-busy={data.loading}
    >
      [Section 8 — System Health] — pending implementation
    </div>
  )
}

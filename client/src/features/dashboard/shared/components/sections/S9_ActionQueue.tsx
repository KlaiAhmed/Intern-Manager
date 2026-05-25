import type { BiActionQueueResponse, BiSectionData } from '../../types/biDashboard'

interface Props { data: BiSectionData<BiActionQueueResponse>; }

export function S9_ActionQueue({ data }: Props) {
  return (
    <div
      style={{ padding: 24, background: '#f5f5f5', borderRadius: 8, marginBottom: 16, color: '#666', fontSize: 14 }}
      aria-busy={data.loading}
    >
      [Section 9 — Action Queue] — pending implementation
    </div>
  )
}

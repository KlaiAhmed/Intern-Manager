import type { BiMissionStatsResponse, BiSectionData } from '../../types/biDashboard'

interface Props { data: BiSectionData<BiMissionStatsResponse>; }

export function S3_MissionStats({ data }: Props) {
  return (
    <div
      style={{ padding: 24, background: '#f5f5f5', borderRadius: 8, marginBottom: 16, color: '#666', fontSize: 14 }}
      aria-busy={data.loading}
    >
      [Section 3 — Mission Stats] — pending implementation
    </div>
  )
}

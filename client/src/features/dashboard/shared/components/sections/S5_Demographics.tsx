import type { BiDemographicsResponse, BiSectionData } from '../../types/biDashboard'

interface Props { data: BiSectionData<BiDemographicsResponse>; }

export function S5_Demographics({ data }: Props) {
  return (
    <div
      style={{ padding: 24, background: '#f5f5f5', borderRadius: 8, marginBottom: 16, color: '#666', fontSize: 14 }}
      aria-busy={data.loading}
    >
      [Section 5 — Demographics] — pending implementation
    </div>
  )
}

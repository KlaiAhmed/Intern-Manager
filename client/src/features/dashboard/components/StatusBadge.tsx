type StatusBadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'
type StatusBadgeSize = 'sm' | 'md'

interface StatusBadgeProps {
  label: string
  tone?: StatusBadgeTone
  size?: StatusBadgeSize
}

export function StatusBadge({ label, tone = 'neutral', size = 'md' }: StatusBadgeProps) {
  return <span className={`dash-status-chip dash-status-chip-${tone} dash-status-chip-${size}`}>{label}</span>
}

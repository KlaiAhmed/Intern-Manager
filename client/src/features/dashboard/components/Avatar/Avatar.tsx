import { memo, type CSSProperties } from 'react'
import './Avatar.css'

type AvatarSize = 'xs' | 'sm' | 'md'

interface AvatarProps {
  name: string
  size?: AvatarSize
  className?: string
}

interface AvatarColorPair {
  bg: string
  fg: string
}

const AVATAR_COLOR_PAIRS: AvatarColorPair[] = [
  { bg: 'var(--dash-accent-subtle)', fg: 'var(--dash-accent)' },
  { bg: 'color-mix(in srgb, var(--dash-success) 12%, var(--dash-bg-primary))', fg: 'var(--dash-success)' },
  { bg: 'color-mix(in srgb, var(--dash-warning) 14%, var(--dash-bg-primary))', fg: 'var(--dash-warning)' },
  { bg: 'color-mix(in srgb, var(--dash-error) 12%, var(--dash-bg-primary))', fg: 'var(--dash-error)' },
  { bg: 'color-mix(in srgb, var(--dash-accent) 16%, var(--dash-bg-secondary))', fg: 'var(--dash-accent-text)' },
  { bg: 'var(--dash-bg-secondary)', fg: 'var(--dash-text-secondary)' },
]

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)

  if (words.length >= 2) {
    return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase()
  }

  return '?'
}

function getColorPair(name: string) {
  const charCodeSum = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0)

  return AVATAR_COLOR_PAIRS[charCodeSum % AVATAR_COLOR_PAIRS.length]
}

export const Avatar = memo(function Avatar({ name, size = 'sm', className = '' }: AvatarProps) {
  const colorPair = getColorPair(name)
  const style: CSSProperties = {
    backgroundColor: colorPair.bg,
    color: colorPair.fg,
  }

  return (
    <span
      className={`dashboard-avatar avatar--${size} ${className}`.trim()}
      style={style}
      role="img"
      aria-label={name}
    >
      {getInitials(name)}
    </span>
  )
})

import { memo } from 'react'

interface SkeletonProps {
  width?: string
  height?: string
  circle?: boolean
}

/**
 * Skeleton — Loading placeholder with shimmer animation
 * Uses CSS custom properties for smooth color transitions
 */
export const Skeleton = memo(function Skeleton({ width = '100%', height = '20px', circle = false }: SkeletonProps) {
  return (
    <div
      className={`dash-skeleton ${circle ? 'dash-skeleton-circle' : ''}`}
      style={{
        width: circle ? height : width,
        height,
      }}
      aria-hidden="true"
    />
  )
})

interface SkeletonProps {
  width?: string
  height?: string
}

/**
 * Composant skeleton pour l'état de chargement.
 */
export function Skeleton({ width = '100%', height = '20px' }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      style={{ width, height }}
      aria-hidden="true"
    />
  )
}

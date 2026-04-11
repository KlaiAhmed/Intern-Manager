import { useEffect, useState } from 'react'
import { getCachedHomeStats, getHomeStats, type HomeStats } from '../api/homeStatsApi'

export function useHomeStats() {
  const [stats, setStats] = useState<HomeStats | null>(() => getCachedHomeStats())

  useEffect(() => {
    let isMounted = true

    void getHomeStats()
      .then((nextStats) => {
        if (isMounted) {
          setStats(nextStats)
        }
      })
      .catch(() => {
        // Keep cached values or zeros if the network request fails.
      })

    return () => {
      isMounted = false
    }
  }, [])

  return stats
}
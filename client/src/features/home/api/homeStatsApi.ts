import { buildApiUrl } from '../../../lib/apiClient'

export interface HomeStats {
  supervisors: number
  interns: number
  missions: number
}

interface HomeStatsCacheEntry {
  cachedAt: number
  data: HomeStats
}

const homeStatsCacheKey = 'axia.home-stats.v1'
const homeStatsCacheTtlMs = 10 * 60 * 1000

let inFlightHomeStatsRequest: Promise<HomeStats> | null = null

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isHomeStats(value: unknown): value is HomeStats {
  if (!isRecord(value)) {
    return false
  }

  return isNumber(value.supervisors) && isNumber(value.interns) && isNumber(value.missions)
}

function isHomeStatsCacheEntry(value: unknown): value is HomeStatsCacheEntry {
  if (!isRecord(value)) {
    return false
  }

  return isNumber(value.cachedAt) && isHomeStats(value.data)
}

function readHomeStatsCacheEntry(): HomeStatsCacheEntry | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const rawValue = window.localStorage.getItem(homeStatsCacheKey)

    if (!rawValue) {
      return null
    }

    const parsedValue: unknown = JSON.parse(rawValue)

    if (!isHomeStatsCacheEntry(parsedValue)) {
      window.localStorage.removeItem(homeStatsCacheKey)
      return null
    }

    return parsedValue
  } catch {
    return null
  }
}

function isCacheFresh(cacheEntry: HomeStatsCacheEntry): boolean {
  return Date.now() - cacheEntry.cachedAt < homeStatsCacheTtlMs
}

function writeHomeStatsCacheEntry(data: HomeStats): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      homeStatsCacheKey,
      JSON.stringify({
        cachedAt: Date.now(),
        data,
      })
    )
  } catch {
    // Ignore storage errors and fall back to in-memory state.
  }
}

async function fetchHomeStats(): Promise<HomeStats> {
  const response = await fetch(buildApiUrl('/api/stats/home'), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Unable to load homepage stats (${response.status}).`)
  }

  let payload: unknown

  try {
    payload = await response.json()
  } catch {
    throw new Error('Unable to parse homepage stats response.')
  }

  if (!isHomeStats(payload)) {
    throw new Error('Invalid homepage stats response.')
  }

  return payload
}

export function getCachedHomeStats(): HomeStats | null {
  return readHomeStatsCacheEntry()?.data ?? null
}

export async function getHomeStats(): Promise<HomeStats> {
  const cachedEntry = readHomeStatsCacheEntry()

  if (cachedEntry && isCacheFresh(cachedEntry)) {
    return cachedEntry.data
  }

  if (inFlightHomeStatsRequest) {
    return inFlightHomeStatsRequest
  }

  inFlightHomeStatsRequest = (async () => {
    try {
      const stats = await fetchHomeStats()
      writeHomeStatsCacheEntry(stats)
      return stats
    } catch (error) {
      if (cachedEntry) {
        return cachedEntry.data
      }

      throw error
    } finally {
      inFlightHomeStatsRequest = null
    }
  })()

  return inFlightHomeStatsRequest
}
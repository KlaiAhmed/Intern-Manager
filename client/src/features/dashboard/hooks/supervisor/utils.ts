export function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  return fallback
}

export function toNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>
    if (typeof candidate.count === 'number') {
      return candidate.count
    }
    if (typeof candidate.value === 'number') {
      return candidate.value
    }
    if (typeof candidate.total === 'number') {
      return candidate.total
    }
  }

  return fallback
}

export function toStringValue(value: unknown, fallback: string = ''): string {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return fallback
}

export function clampProgress(value: number): number {
  if (Number.isNaN(value)) {
    return 0
  }

  if (value <= 0) {
    return 0
  }

  if (value >= 100) {
    return 100
  }

  return Math.round(value)
}

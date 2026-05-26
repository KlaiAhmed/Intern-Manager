import { format, isValid, parse } from 'date-fns'

export function formatNumberValue(value: unknown): string {
  const numericValue = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numericValue)) {
    return String(value)
  }

  return numericValue.toLocaleString()
}

export function formatPercentValue(value: unknown): string {
  const numericValue = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numericValue)) {
    return `${String(value)}%`
  }

  return `${numericValue.toFixed(1)}%`
}

export function formatScoreValue(value: unknown): string {
  const numericValue = typeof value === 'number' ? value : Number(value)

  if (!Number.isFinite(numericValue)) {
    return '0.00'
  }

  return numericValue.toFixed(2)
}

export function formatMonthLabel(value: unknown): string {
  const rawValue = String(value)
  const parsedMonth = parse(rawValue, 'yyyy-MM', new Date())

  return isValid(parsedMonth) ? format(parsedMonth, 'MMM yyyy') : rawValue
}

export function formatNumberTooltip(value: unknown, name: unknown) {
  return [formatNumberValue(value), String(name)]
}

export function formatPercentTooltip(value: unknown, name: unknown) {
  return [formatPercentValue(value), String(name)]
}

export function formatScoreTooltip(value: unknown, name: unknown) {
  return [formatScoreValue(value), String(name)]
}

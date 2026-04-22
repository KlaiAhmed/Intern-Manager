import type {
  AccountStatus,
  AuditLogApi,
  AuditLogRecord,
  CountResponse,
  DashboardUser,
  DashboardUserApi,
  EvaluationApi,
  EvaluationRecord,
  InternApi,
  InternRecord,
  InternshipApi,
  InternshipHistoryApi,
  InternshipHistoryRecord,
  InternshipRecord,
  PagedResponse,
  ReferentialApi,
  ReferentialRecord,
} from '../types/operations'

function splitFullName(value: string): { firstName: string; lastName: string } {
  const parts = value.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return { firstName: '', lastName: '' }
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] }
  }

  return { firstName: parts[0], lastName: parts.slice(1).join(' ') }
}

export function parseAccountStatus(value: string | undefined): AccountStatus {
  const normalized = value?.trim().toLowerCase()
  return normalized === 'archived' || normalized === 'inactive' ? 'archived' : 'active'
}

export function toDateInputValue(value: string | null): string {
  if (!value) {
    return ''
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function toIsoDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day, 0, 0, 0, 0)
  return date.toISOString()
}

export function readCount(payload: CountResponse | null | undefined): number {
  if (!payload || typeof payload.count !== 'number') {
    return 0
  }

  return payload.count
}

export function mapUserApi(record: DashboardUserApi): DashboardUser | null {
  const id = String(record.id ?? '').trim()
  const email = String(record.email ?? '').trim()
  const role = String(record.role ?? '').trim().toLowerCase()

  if (!id || !email || !role) {
    return null
  }

  const rawFullName =
    String(record.fullName ?? '').trim()
    || String(record.name ?? '').trim()
    || `${record.firstName ?? ''} ${record.lastName ?? ''}`.trim()
  const fullName = rawFullName || email
  const splitName = splitFullName(fullName)

  return {
    id,
    firstName: String(record.firstName ?? '').trim() || splitName.firstName,
    lastName: String(record.lastName ?? '').trim() || splitName.lastName,
    fullName,
    email,
    role,
    status: parseAccountStatus(String(record.status ?? '')),
    department: String(record.department ?? '').trim(),
  }
}

export function mapInternApi(record: InternApi): InternRecord | null {
  const id = String(record.id ?? '').trim()
  const fullName = String(record.fullName ?? '').trim()
  const email = String(record.email ?? '').trim()

  if (!id || !fullName || !email) {
    return null
  }

  return {
    id,
    fullName,
    email,
    accountStatus: String(record.accountStatus ?? record.status ?? '').trim() || 'Unknown',
    verificationStatus: String(record.verificationStatus ?? '').trim() || 'Unknown',
    cvFileUrl: record.cvFileUrl ?? null,
    startDate: record.startDate ?? null,
    endDate: record.endDate ?? null,
  }
}

export function mapInternshipApi(record: InternshipApi): InternshipRecord | null {
  const id = String(record.id ?? '').trim()
  const supervisorId = String(record.supervisorId ?? '').trim()

  if (!id || !supervisorId) {
    return null
  }

  return {
    id,
    missionTitle: String(record.missionTitle ?? '').trim() || 'Untitled internship',
    internId: record.internId ? String(record.internId).trim() : null,
    internName: record.internName ? String(record.internName).trim() : null,
    supervisorId,
    supervisorName: record.supervisorName ? String(record.supervisorName).trim() : null,
    coSupervisorId: record.coSupervisorId ? String(record.coSupervisorId).trim() : null,
    department: record.department ? String(record.department).trim() : null,
    type: record.type ? String(record.type).trim() : null,
    status: String(record.status ?? '').trim() || 'template',
    startDate: String(record.startDate ?? '').trim(),
    endDate: record.endDate ? String(record.endDate).trim() : null,
    objectives: String(record.objectives ?? '').trim(),
  }
}

export function mapHistoryApi(record: InternshipHistoryApi): InternshipHistoryRecord | null {
  const id = String(record.id ?? '').trim()
  const field = String(record.field ?? '').trim()

  if (!id || !field) {
    return null
  }

  return {
    id,
    field,
    oldValue: String(record.oldValue ?? ''),
    newValue: String(record.newValue ?? ''),
    changedBy: String(record.changedBy ?? 'Unknown').trim(),
    changedAt: String(record.changedAt ?? '').trim(),
  }
}

export function mapEvaluationApi(record: EvaluationApi): EvaluationRecord | null {
  const id = String(record.id ?? '').trim()
  const supervisorId = String(record.supervisorId ?? '').trim()
  const internId = String(record.internId ?? '').trim()

  if (!id || !supervisorId || !internId) {
    return null
  }

  return {
    id,
    supervisorId,
    supervisorName: String(record.supervisorName ?? 'Unknown').trim(),
    internId,
    internName: String(record.internName ?? 'Unknown').trim(),
    type: String(record.type ?? '').trim() || 'unknown',
    status: String(record.status ?? '').trim() || 'unknown',
    submittedAt: record.submittedAt ?? null,
    comments: String(record.comments ?? '').trim(),
    technical: Number(record.criteria?.technical ?? 0),
    autonomy: Number(record.criteria?.autonomy ?? 0),
    communication: Number(record.criteria?.communication ?? 0),
    deadlineRespect: Number(record.criteria?.deadlineRespect ?? 0),
    deliverableQuality: Number(record.criteria?.deliverableQuality ?? 0),
  }
}

export function mapReferentialApi(record: ReferentialApi): ReferentialRecord | null {
  const id = String(record.id ?? '').trim()
  const name = String(record.name ?? '').trim()

  if (!id || !name) {
    return null
  }

  return { id, name }
}

export function mapAuditApi(record: AuditLogApi): AuditLogRecord | null {
  const id = String(record.id ?? '').trim()
  const actor = String(record.actor ?? '').trim()
  const action = String(record.action ?? '').trim()
  const entity = String(record.entity ?? '').trim()
  const timestamp = String(record.timestamp ?? '').trim()

  if (!id || !actor || !action || !entity || !timestamp) {
    return null
  }

  return {
    id,
    actor,
    action,
    entity,
    timestamp,
  }
}

export function parseReferentialResponse(
  payload: ReferentialApi[] | PagedResponse<ReferentialApi> | null | undefined,
): ReferentialRecord[] {
  if (!payload) {
    return []
  }

  if (Array.isArray(payload)) {
    return payload.map(mapReferentialApi).filter((item): item is ReferentialRecord => item !== null)
  }

  return (payload.data ?? []).map(mapReferentialApi).filter((item): item is ReferentialRecord => item !== null)
}

function toCsvValue(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function triggerCsvDownload(fileName: string, rows: string[][]): void {
  const csvContent = rows.map((row) => row.map(toCsvValue).join(',')).join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const blobUrl = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = blobUrl
  anchor.setAttribute('download', fileName)
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(blobUrl)
}

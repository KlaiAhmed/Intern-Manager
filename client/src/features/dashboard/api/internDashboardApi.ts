import { apiFetch } from '../../../lib/apiClient'
import { getCsrfCookieToken } from '../../../lib/auth'
import { uploadWithProgress, type UploadProgress } from '../../../lib/uploadWithProgress'
import type {
  CompleteInternTaskResponse,
  CreateJournalEntryRequest,
  CreatedJournalEntryResponse,
  CvUploadResponse,
  DeliverableVersionHistoryResponse,
  DeliverableVersionResponse,
  InternCurrentMissionSummaryResponse,
  InternDashboardActionResponse,
  InternDashboardPagedResponse,
  InternDeliverableResponse,
  InternDetailResponse,
  InternEvaluationsResponse,
  InternJournalEntriesResponse,
  InternMeetingDetailResponse,
  InternMeetingsCountResponse,
  InternMeetingsResponse,
  InternMissionFeatureFlagsResponse,
  InternMissionHistoryResponse,
  InternNotificationPageResponse,
  InternNotificationResponse,
  InternProfileResponse,
  InternTaskResponse,
  MarkAllInternNotificationsReadResponse,
  ReferentialResponse,
  ReplaceInternSkillsRequest,
  ReplaceInternSkillsResponse,
  SubmitDeliverableVersionRequest,
  UpdateInternProfileRequest,
} from '../types/intern.types'

interface RequestJsonOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  withCsrf?: boolean
}

interface ListParams {
  page?: number
  limit?: number
}

interface EvaluationListParams {
  page?: number
  pageSize?: number
}

interface MeetingListParams extends ListParams {
  upcoming?: boolean
}

interface NotificationListParams {
  isRead?: boolean
  page?: number
  pageSize?: number
}

interface UploadOptions {
  onProgress?: (progress: UploadProgress) => void
  signal?: AbortSignal
}

function appendNumberParam(params: URLSearchParams, key: string, value: number | undefined): void {
  if (typeof value === 'number' && Number.isFinite(value)) {
    params.set(key, String(value))
  }
}

function appendBooleanParam(params: URLSearchParams, key: string, value: boolean | undefined): void {
  if (typeof value === 'boolean') {
    params.set(key, String(value))
  }
}

function withQueryString(path: string, params: URLSearchParams): string {
  const queryString = params.toString()
  return queryString ? `${path}?${queryString}` : path
}

function buildListPath(path: string, params: ListParams | undefined): string {
  const searchParams = new URLSearchParams()
  appendNumberParam(searchParams, 'page', params?.page)
  appendNumberParam(searchParams, 'limit', params?.limit)
  return withQueryString(path, searchParams)
}

function buildEvaluationListPath(params: EvaluationListParams | undefined): string {
  const searchParams = new URLSearchParams()
  appendNumberParam(searchParams, 'page', params?.page)
  appendNumberParam(searchParams, 'pageSize', params?.pageSize)
  return withQueryString('/api/intern/me/evaluations', searchParams)
}

function buildMeetingListPath(params: MeetingListParams | undefined): string {
  const searchParams = new URLSearchParams()
  searchParams.set('internId', 'me')
  appendBooleanParam(searchParams, 'upcoming', params?.upcoming)
  appendNumberParam(searchParams, 'page', params?.page)
  appendNumberParam(searchParams, 'limit', params?.limit)
  return withQueryString('/api/meetings', searchParams)
}

function buildNotificationListPath(params: NotificationListParams | undefined): string {
  const searchParams = new URLSearchParams()
  appendBooleanParam(searchParams, 'isRead', params?.isRead)
  appendNumberParam(searchParams, 'page', params?.page)
  appendNumberParam(searchParams, 'pageSize', params?.pageSize)
  return withQueryString('/api/intern/me/notifications', searchParams)
}

function buildJsonHeaders(withCsrf: boolean | undefined): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json',
  })

  if (withCsrf && getCsrfCookieToken()) {
    headers.set('X-CSRF-Token', getCsrfCookieToken() ?? '')
  }

  return headers
}

function getErrorMessagePayload(payload: unknown): string | null {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim()
  }

  if (typeof payload !== 'object' || payload === null) {
    return null
  }

  const record = payload as Record<string, unknown>
  for (const key of ['message', 'detail', 'title', 'error']) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204 || response.status === 205) {
    return undefined
  }

  const rawBody = await response.text()
  if (!rawBody.trim()) {
    return undefined
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json') || contentType.includes('text/json') || contentType.includes('+json')) {
    return JSON.parse(rawBody) as unknown
  }

  return rawBody
}

async function requestJson<TResponse>(path: string, options: RequestJsonOptions = {}): Promise<TResponse> {
  const method = options.method ?? 'GET'
  const response = await apiFetch(path, {
    method,
    headers: method === 'GET' ? undefined : buildJsonHeaders(options.withCsrf ?? true),
    body: method === 'GET' || options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  const payload = await parseResponseBody(response)

  if (!response.ok) {
    const fallbackMessage = response.statusText || `Request failed with status ${response.status}.`
    throw new Error(getErrorMessagePayload(payload) ?? fallbackMessage)
  }

  return payload as TResponse
}

function buildDeliverableVersionFormData(request: SubmitDeliverableVersionRequest): FormData {
  const formData = new FormData()

  if (request.file) {
    formData.append('file', request.file)
  }

  if (request.gitHubUrl) {
    formData.append('gitHubUrl', request.gitHubUrl)
  }

  if (request.gitHubBranch) {
    formData.append('gitHubBranch', request.gitHubBranch)
  }

  if (request.message) {
    formData.append('message', request.message)
  }

  formData.append('rowVersion', String(request.rowVersion))

  return formData
}

function buildFileFormData(file: File): FormData {
  const formData = new FormData()
  formData.append('file', file)
  return formData
}

export const internDashboardApi = {
  getInternStatus(internId: string): Promise<InternDetailResponse> {
    return requestJson<InternDetailResponse>(`/api/interns/${internId}`)
  },

  getMissionSummary(): Promise<InternCurrentMissionSummaryResponse> {
    return requestJson<InternCurrentMissionSummaryResponse>('/api/intern/me/internship')
  },

  getMissionHistory(): Promise<InternMissionHistoryResponse> {
    return requestJson<InternMissionHistoryResponse>('/api/intern/me/missions')
  },

  getMissionFeatureFlags(): Promise<InternMissionFeatureFlagsResponse> {
    return requestJson<InternMissionFeatureFlagsResponse>('/api/intern/me/feature-flags')
  },

  getTasks(params?: ListParams): Promise<InternDashboardPagedResponse<InternTaskResponse>> {
    return requestJson<InternDashboardPagedResponse<InternTaskResponse>>(buildListPath('/api/intern/me/tasks', params))
  },

  completeTask(params: { taskId: string; rowVersion: number }): Promise<CompleteInternTaskResponse> {
    return requestJson<CompleteInternTaskResponse>(`/api/tasks/${params.taskId}/complete`, {
      method: 'PATCH',
      body: { rowVersion: params.rowVersion },
    })
  },

  getDeliverables(params?: ListParams): Promise<InternDashboardPagedResponse<InternDeliverableResponse>> {
    return requestJson<InternDashboardPagedResponse<InternDeliverableResponse>>(buildListPath('/api/intern/me/deliverables', params))
  },

  submitDeliverableFile(
    deliverableId: string,
    file: File,
    options: UploadOptions = {},
  ): Promise<DeliverableVersionResponse> {
    // TODO: this function cannot send rowVersion and will always 409.
    // Pass a full SubmitDeliverableVersionRequest to fix it.
    return uploadWithProgress<DeliverableVersionResponse>({
      path: `/api/deliverables/${deliverableId}/versions`,
      formData: buildFileFormData(file),
      onProgress: options.onProgress,
      signal: options.signal,
    })
  },

  submitDeliverableVersion(
    request: SubmitDeliverableVersionRequest,
    options: UploadOptions = {},
  ): Promise<DeliverableVersionResponse> {
    return uploadWithProgress<DeliverableVersionResponse>({
      path: `/api/deliverables/${request.deliverableId}/versions`,
      formData: buildDeliverableVersionFormData(request),
      onProgress: options.onProgress,
      signal: options.signal,
    })
  },

  getDeliverableVersions(deliverableId: string): Promise<DeliverableVersionHistoryResponse> {
    return requestJson<DeliverableVersionHistoryResponse>(`/api/deliverables/${deliverableId}/versions`)
  },

  getJournalEntries(limit = 10): Promise<InternJournalEntriesResponse> {
    const params = new URLSearchParams()
    params.set('limit', String(limit))
    return requestJson<InternJournalEntriesResponse>(withQueryString('/api/intern/me/journal', params))
  },

  createJournalEntry(request: CreateJournalEntryRequest): Promise<CreatedJournalEntryResponse> {
    return requestJson<CreatedJournalEntryResponse>('/api/intern/me/journal', {
      method: 'POST',
      body: request,
    })
  },

  getEvaluations(params?: EvaluationListParams): Promise<InternEvaluationsResponse> {
    return requestJson<InternEvaluationsResponse>(buildEvaluationListPath(params))
  },

  getMeetings(params?: MeetingListParams): Promise<InternMeetingsResponse> {
    return requestJson<InternMeetingsResponse>(buildMeetingListPath(params))
  },

  getNextMeeting(): Promise<InternMeetingsResponse> {
    return requestJson<InternMeetingsResponse>(buildMeetingListPath({ upcoming: true, page: 1, limit: 1 }))
  },

  getUpcomingMeetingsCount(): Promise<InternMeetingsCountResponse> {
    const params = new URLSearchParams()
    params.set('internId', 'me')
    params.set('upcoming', 'true')
    params.set('count', 'true')
    return requestJson<InternMeetingsCountResponse>(withQueryString('/api/meetings', params))
  },

  getMeeting(meetingId: string): Promise<InternMeetingDetailResponse> {
    return requestJson<InternMeetingDetailResponse>(`/api/meetings/${meetingId}`)
  },

  getProfile(): Promise<InternProfileResponse> {
    return requestJson<InternProfileResponse>('/api/intern/me/profile')
  },

  updateProfile(request: UpdateInternProfileRequest): Promise<InternProfileResponse> {
    return requestJson<InternProfileResponse>('/api/intern/me/profile', {
      method: 'PATCH',
      body: request,
    })
  },

  replaceSkills(request: ReplaceInternSkillsRequest): Promise<ReplaceInternSkillsResponse> {
    return requestJson<ReplaceInternSkillsResponse>('/api/intern/me/profile/skills', {
      method: 'PUT',
      body: request,
    })
  },

  uploadCv(file: File, options: UploadOptions = {}): Promise<CvUploadResponse> {
    return uploadWithProgress<CvUploadResponse>({
      path: '/api/intern/me/profile/cv',
      formData: buildFileFormData(file),
      onProgress: options.onProgress,
      signal: options.signal,
    })
  },

  getSchools(): Promise<ReferentialResponse[]> {
    return requestJson<ReferentialResponse[]>('/api/intern/me/profile/schools')
  },

  getSkills(): Promise<{ data: ReferentialResponse[] }> {
    return requestJson<{ data: ReferentialResponse[] }>('/api/admin/settings/skills')
  },

  getNotifications(params?: NotificationListParams): Promise<InternNotificationPageResponse> {
    return requestJson<InternNotificationPageResponse>(buildNotificationListPath(params))
  },

  markNotificationRead(notificationId: number): Promise<InternNotificationResponse> {
    return requestJson<InternNotificationResponse>(`/api/intern/me/notifications/${notificationId}/read`, {
      method: 'PATCH',
      body: {},
    })
  },

  markAllNotificationsRead(): Promise<MarkAllInternNotificationsReadResponse> {
    return requestJson<MarkAllInternNotificationsReadResponse>('/api/intern/me/notifications/read-all', {
      method: 'PATCH',
      body: {},
    })
  },
}

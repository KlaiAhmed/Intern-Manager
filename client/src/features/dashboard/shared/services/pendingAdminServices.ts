import type {
  ArchiveHistoryRecord,
  BiAccessMatrix,
  EmailTemplate,
  EmailTemplateFormState,
  NotificationRule,
} from '../types/operations'

export class PendingEndpointError extends Error {
  status: number
  endpoint: string

  constructor(endpoint: string) {
    super(`501 Not Implemented - endpoint pending: ${endpoint}`)
    this.name = 'PendingEndpointError'
    this.status = 501
    this.endpoint = endpoint
  }
}

function throwPendingEndpoint(endpoint: string): never {
  throw new PendingEndpointError(endpoint)
}

export const pendingAdminServices = {
  async listNotificationRules(): Promise<NotificationRule[]> {
    // TODO(api): Implement GET /api/admin/notifications/rules for notification rules management.
    throwPendingEndpoint('GET /api/admin/notifications/rules')
  },
  async updateNotificationRule(ruleId: string, enabled: boolean): Promise<void> {
    // TODO(api): Implement PATCH /api/admin/notifications/rules/{ruleId} to update notification rules.
    void ruleId
    void enabled
    throwPendingEndpoint('PATCH /api/admin/notifications/rules/{ruleId}')
  },
  async listEmailTemplates(): Promise<EmailTemplate[]> {
    // TODO(api): Implement GET /api/admin/email-templates for email template management.
    throwPendingEndpoint('GET /api/admin/email-templates')
  },
  async saveEmailTemplate(template: EmailTemplateFormState): Promise<void> {
    // TODO(api): Implement PATCH /api/admin/email-templates/{id} for email template updates.
    void template
    throwPendingEndpoint('PATCH /api/admin/email-templates/{id}')
  },
  async triggerArchive(): Promise<void> {
    // TODO(api): Implement POST /api/admin/archive for annual archive execution.
    throwPendingEndpoint('POST /api/admin/archive')
  },
  async listArchiveHistory(): Promise<ArchiveHistoryRecord[]> {
    // TODO(api): Implement GET /api/admin/archive/history to list archive jobs.
    throwPendingEndpoint('GET /api/admin/archive/history')
  },
  async listBiAccessMatrix(): Promise<BiAccessMatrix[]> {
    // TODO(api): Implement GET /api/admin/bi-access for BI access matrix retrieval.
    throwPendingEndpoint('GET /api/admin/bi-access')
  },
  async saveBiAccessMatrix(matrix: BiAccessMatrix[]): Promise<void> {
    // TODO(api): Implement PATCH /api/admin/bi-access for BI access matrix updates.
    void matrix
    throwPendingEndpoint('PATCH /api/admin/bi-access')
  },
}

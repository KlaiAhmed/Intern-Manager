import { useCallback, useEffect, useState } from 'react'
import { DashboardButton } from '../../components/DashboardButton'
import { Edit } from '../../components/IconComponents'
import { Modal } from '../../components/Modal'
import { Panel } from '../../components/Panel'
import { Skeleton } from '../../components/Skeleton'
import { pendingAdminServices } from '../services/pendingAdminServices'
import type { EmailTemplate, EmailTemplateFormState, NotificationRule } from '../types/operations'
import { defaultEmailTemplateFormState } from '../types/operations'
import { toDashboardErrorMessage } from '../utils/errorMessage'
import styles from './OperationalNotificationsEmailSection.module.css'

export function OperationalNotificationsEmailSection() {
  const [loading, setLoading] = useState(true)
  const [bannerError, setBannerError] = useState<string | null>(null)
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [templateModalOpen, setTemplateModalOpen] = useState(false)
  const [templateForm, setTemplateForm] = useState<EmailTemplateFormState>(defaultEmailTemplateFormState)

  const loadData = useCallback(async () => {
    setLoading(true)
    setBannerError(null)

    try {
      const [rulesPayload, templatesPayload] = await Promise.all([
        pendingAdminServices.listNotificationRules(),
        pendingAdminServices.listEmailTemplates(),
      ])

      setRules(rulesPayload)
      setTemplates(templatesPayload)
    } catch (requestError) {
      setBannerError(toDashboardErrorMessage(requestError))
      setRules([])
      setTemplates([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const saveTemplate = async () => {
    try {
      await pendingAdminServices.saveEmailTemplate(templateForm)
    } catch (requestError) {
      setBannerError(toDashboardErrorMessage(requestError))
    }
  }

  return (
    <section className={`${styles.root} super-admin-section admin-view-section`} id="section-notification-email">
      <header className="section-header-row">
        <div className="section-header-text">
          <h2 className="section-title">Notification and Email Template Manager</h2>
          <p className="section-subtitle">Configure notification rules and email templates for platform events.</p>
        </div>
      </header>

      {bannerError && <div className="admin-inline-banner">{bannerError}</div>}

      <Panel title="Notification Rules" className="dash-panel-table">
        {loading ? (
          <Skeleton height="180px" />
        ) : rules.length === 0 ? (
          <div className="dash-empty">
            <h3 className="dash-empty-title">Endpoint not yet available</h3>
            <p className="dash-empty-description">Rules will appear here when notification-rules endpoints are implemented.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="dash-table super-admin-table">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Trigger</th>
                  <th>Enabled</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id}>
                    <td>{rule.name}</td>
                    <td>{rule.trigger}</td>
                    <td>
                      <label className="admin-toggle">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={() => void pendingAdminServices.updateNotificationRule(rule.id, !rule.enabled)}
                        />
                        <span>Toggle</span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Email Templates"
        actions={(
          <DashboardButton variant="primary" size="sm" onClick={() => setTemplateModalOpen(true)}>
            <Edit />
            <span>Edit Template</span>
          </DashboardButton>
        )}
        className="dash-panel-table"
      >
        {loading ? (
          <Skeleton height="180px" />
        ) : templates.length === 0 ? (
          <div className="dash-empty">
            <h3 className="dash-empty-title">Endpoint not yet available</h3>
            <p className="dash-empty-description">Templates will appear when email-template endpoints are implemented.</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="dash-table super-admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Subject</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td>{template.name}</td>
                    <td>{template.subject}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal
        isOpen={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title="Edit Email Template"
      >
        <form
          className="modal-form"
          onSubmit={(event) => {
            event.preventDefault()
            void saveTemplate()
          }}
        >
          <div className="form-field">
            <label htmlFor="template-name">Template Name</label>
            <input
              id="template-name"
              type="text"
              value={templateForm.name}
              onChange={(event) => setTemplateForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="welcome_intern"
            />
          </div>

          <div className="form-field">
            <label htmlFor="template-subject">Subject</label>
            <input
              id="template-subject"
              type="text"
              value={templateForm.subject}
              onChange={(event) => setTemplateForm((prev) => ({ ...prev, subject: event.target.value }))}
              placeholder="Welcome {{firstName}}"
            />
          </div>

          <div className="form-field">
            <label htmlFor="template-body">Body (supports {'{{variable}}'} placeholders)</label>
            <textarea
              id="template-body"
              className="admin-textarea"
              value={templateForm.body}
              onChange={(event) => setTemplateForm((prev) => ({ ...prev, body: event.target.value }))}
            />
          </div>

          <div className="admin-preview-panel">
            <h3>Preview</h3>
            <pre>{templateForm.body || 'Template preview will appear here.'}</pre>
          </div>

          <div className="modal-actions">
            <DashboardButton variant="secondary" size="md" onClick={() => setTemplateModalOpen(false)} type="button">
              Close
            </DashboardButton>
            <DashboardButton
              variant="secondary"
              size="md"
              type="button"
              disabled
              title="Disabled until POST /api/admin/email-templates/test-send is implemented"
            >
              Test Send
            </DashboardButton>
            <DashboardButton variant="primary" size="md" type="submit">
              Save Template
            </DashboardButton>
          </div>
        </form>
      </Modal>
    </section>
  )
}

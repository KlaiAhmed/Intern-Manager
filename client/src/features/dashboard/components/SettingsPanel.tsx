import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit, Trash2 } from './IconComponents'
import { useDashboardApi } from '../hooks/useDashboardApi'
import { Skeleton } from './Skeleton'
import { ErrorState } from './ErrorState'
import { Modal } from './Modal'
import { useI18n } from '../../../locales/I18nContext'

export type SettingsSubSection = 'departments' | 'schools' | 'types' | 'skills' | 'verification-statuses'

interface SettingsItem {
  id: string
  name: string
}

interface SettingsPanelProps {
  activeSubSection: SettingsSubSection
  onSubSectionChange: (subsection: SettingsSubSection) => void
}

const tabs: { id: SettingsSubSection; label: string; endpoint: string }[] = [
  { id: 'departments', label: 'dashboard.settings.tab.departments', endpoint: 'departments' },
  { id: 'schools', label: 'dashboard.settings.tab.schools', endpoint: 'schools' },
  { id: 'types', label: 'dashboard.settings.tab.internshipTypes', endpoint: 'internship-types' },
  { id: 'skills', label: 'dashboard.settings.tab.skills', endpoint: 'skills' },
  { id: 'verification-statuses', label: 'dashboard.settings.tab.verificationStatuses', endpoint: 'verification-statuses' },
]

function parseSettingsItems(payload: unknown): SettingsItem[] {
  if (Array.isArray(payload)) {
    return payload
      .map((item) => {
        if (!item || typeof item !== 'object') {
          return null
        }

        const record = item as Record<string, unknown>
        const id = String(record.id ?? '')
        const name = String(record.name ?? '')

        if (!id || !name) {
          return null
        }

        return { id, name }
      })
      .filter((item): item is SettingsItem => item !== null)
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    if (Array.isArray(record.data)) {
      return parseSettingsItems(record.data)
    }
  }

  return []
}

export function SettingsPanel({
  activeSubSection,
  onSubSectionChange,
}: SettingsPanelProps) {
  const { get, post, patch, del } = useDashboardApi()
  const { t } = useI18n()

  const [items, setItems] = useState<SettingsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<SettingsItem | null>(null)
  const [formData, setFormData] = useState({ name: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const activeTab = tabs.find((t) => t.id === activeSubSection) ?? tabs[0]

  const fetchItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await get<unknown>(`/api/admin/settings/${activeTab.endpoint}`)
      setItems(parseSettingsItems(result))
    } catch {
      setError(t('dashboard.settings.operationFailed'))
    } finally {
      setLoading(false)
    }
  }, [activeTab.endpoint, get, t])

  useEffect(() => {
    void fetchItems()
  }, [fetchItems])

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setFormError(t('dashboard.settings.nameRequired'))
      return
    }
    setIsSubmitting(true)
    setFormError(null)
    try {
      if (editingItem) {
        await patch(`/api/admin/settings/${activeTab.endpoint}/${editingItem.id}`, {
          name: formData.name.trim(),
        })
      } else {
        await post(`/api/admin/settings/${activeTab.endpoint}`, {
          name: formData.name.trim(),
        })
      }
      setIsModalOpen(false)
      setEditingItem(null)
      setFormData({ name: '' })
      await fetchItems()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t('dashboard.settings.operationFailed'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (item: SettingsItem) => {
    setEditingItem(item)
    setFormData({ name: item.name })
    setFormError(null)
    setIsModalOpen(true)
  }

  const handleDelete = async (itemId: string) => {
    if (confirm(t('dashboard.settings.deleteConfirm', { item: t(activeTab.label).toLowerCase() }))) {
      try {
        await del(`/api/admin/settings/${activeTab.endpoint}/${itemId}`)
        await fetchItems()
      } catch {
        setError(t('dashboard.settings.deleteFailed', { item: t(activeTab.label).toLowerCase() }))
      }
    }
  }

  return (
    <section className="settings-panel">
      {/* Tab Navigation */}
      <nav className="settings-tabs" aria-label={t('dashboard.settings.aria.subNav')}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeSubSection === tab.id}
            className={`settings-tab ${activeSubSection === tab.id ? 'active' : ''}`}
            onClick={() => onSubSectionChange(tab.id)}
          >
            {t(tab.label)}
          </button>
        ))}
      </nav>

      {/* Add Button */}
      <div className="settings-header-row">
        <h2 className="section-title">
          {t(activeTab.label)} <span className="item-count">({items.length})</span>
        </h2>
        <button
          className="dash-btn dash-btn-primary dash-btn-md"
          onClick={() => {
            setEditingItem(null)
            setFormData({ name: '' })
            setFormError(null)
            setIsModalOpen(true)
          }}
        >
          <span className="btn-icon"><Plus /></span>
          <span>{t('dashboard.form.add')} {t(activeTab.label).slice(0, -1)}</span>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="skeleton-block">
          <Skeleton height="56px" />
          <Skeleton height="56px" />
          <Skeleton height="56px" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchItems} />
      ) : items.length === 0 ? (
        <div className="dash-empty">
          <p>{t('dashboard.settings.noItems', { items: t(activeTab.label).toLowerCase() })}</p>
          <button
            className="dash-btn dash-btn-secondary dash-btn-md settings-add-first-btn"
            onClick={() => setIsModalOpen(true)}
          >
            {t('dashboard.settings.addFirst', { item: t(activeTab.label).slice(0, -1).toLowerCase() })}
          </button>
        </div>
      ) : (
        <div className="settings-items">
          {items.map((item) => (
            <div key={item.id} className="settings-item">
              <div className="settings-item-info">
                <h3 className="settings-item-name">{item.name}</h3>
              </div>
              <div className="settings-item-actions">
                <button
                  className="action-btn action-btn-edit"
                  onClick={() => handleEdit(item)}
          aria-label={`${t('dashboard.settings.edit')} ${item.name}`}
          title={t('dashboard.settings.edit')}
                >
                  <Edit />
                </button>
                <button
                  className="action-btn action-btn-delete"
                  onClick={() => handleDelete(item.id)}
          aria-label={`${t('dashboard.settings.delete')} ${item.name}`}
          title={t('dashboard.settings.delete')}
                >
                  <Trash2 />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? `${t('dashboard.settings.edit')} ${t(activeTab.label).slice(0, -1)}` : `${t('dashboard.form.add')} ${t(activeTab.label).slice(0, -1)}`}
      >
        <form
          className="modal-form"
          onSubmit={(e) => {
            e.preventDefault()
            void handleSubmit()
          }}
        >
          <div className="form-field">
            <label htmlFor="item-name">
              Name <span className="required">*</span>
            </label>
            <input
              id="item-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={`Enter ${activeTab.label.toLowerCase()} name`}
              className={formError ? 'input-error' : ''}
            />
          </div>
          {formError && (
            <div className="form-error">
              <span className="error-icon">⚠</span>
              {formError}
            </div>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="dash-btn dash-btn-secondary dash-btn-md"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="dash-btn dash-btn-primary dash-btn-md"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  )
}

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2 } from './IconComponents'
import { useDashboardApi } from '../hooks/useDashboardApi'
import { Skeleton } from './Skeleton'
import { ErrorState } from './ErrorState'
import { Modal } from './Modal'
import './SettingsPanel.css'

export type SettingsSubSection = 'departments' | 'schools' | 'types' | 'skills' | 'statuses'

interface SettingsItem {
  id: string
  name: string
  description?: string
}

interface SettingsPanelProps {
  activeSubSection: SettingsSubSection
  onSubSectionChange: (subsection: SettingsSubSection) => void
}

const tabs: { id: SettingsSubSection; label: string; endpoint: string }[] = [
  { id: 'departments', label: 'Departments', endpoint: 'departments' },
  { id: 'schools', label: 'Schools', endpoint: 'schools' },
  { id: 'types', label: 'Internship Types', endpoint: 'types' },
  { id: 'skills', label: 'Skills', endpoint: 'skills' },
  { id: 'statuses', label: 'Statuses', endpoint: 'statuses' },
]

export function SettingsPanel({
  activeSubSection,
  onSubSectionChange,
}: SettingsPanelProps) {
  const api = useDashboardApi()

  const [items, setItems] = useState<SettingsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<SettingsItem | null>(null)
  const [formData, setFormData] = useState({ name: '', description: '' })
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const activeTab = tabs.find((t) => t.id === activeSubSection) ?? tabs[0]

  const fetchItems = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.get<{
        data: SettingsItem[]
      }>(`/api/admin/settings/${activeTab.endpoint}`)
      setItems(result.data ?? [])
    } catch {
      setError(`Failed to load ${activeTab.label.toLowerCase()}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchItems()
  }, [activeSubSection])

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setFormError('Name is required')
      return
    }
    setIsSubmitting(true)
    setFormError(null)
    try {
      if (editingItem) {
        await api.patch(`/api/admin/settings/${activeTab.endpoint}/${editingItem.id}`, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
        })
      } else {
        await api.post(`/api/admin/settings/${activeTab.endpoint}`, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
        })
      }
      setIsModalOpen(false)
      setEditingItem(null)
      setFormData({ name: '', description: '' })
      await fetchItems()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Operation failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (item: SettingsItem) => {
    setEditingItem(item)
    setFormData({ name: item.name, description: item.description ?? '' })
    setFormError(null)
    setIsModalOpen(true)
  }

  const handleDelete = async (itemId: string) => {
    if (confirm(`Are you sure you want to delete this ${activeTab.label.toLowerCase()}?`)) {
      try {
        await api.del(`/api/admin/settings/${activeTab.endpoint}/${itemId}`)
        await fetchItems()
      } catch {
        setError(`Failed to delete ${activeTab.label.toLowerCase()}`)
      }
    }
  }

  return (
    <section className="settings-panel">
      {/* Tab Navigation */}
      <nav className="settings-tabs" aria-label="Settings sub-navigation">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeSubSection === tab.id}
            className={`settings-tab ${activeSubSection === tab.id ? 'active' : ''}`}
            onClick={() => onSubSectionChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Add Button */}
      <div className="settings-header-row">
        <h2 className="section-title">
          {activeTab.label} <span className="item-count">({items.length})</span>
        </h2>
        <button
          className="dash-btn dash-btn-primary dash-btn-md"
          onClick={() => {
            setEditingItem(null)
            setFormData({ name: '', description: '' })
            setFormError(null)
            setIsModalOpen(true)
          }}
        >
          <span className="btn-icon"><Plus /></span>
          <span>Add {activeTab.label.slice(0, -1)}</span>
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
          <p>No {activeTab.label.toLowerCase()} configured yet.</p>
          <button
            className="dash-btn dash-btn-secondary dash-btn-md"
            onClick={() => setIsModalOpen(true)}
            style={{ marginTop: '1rem' }}
          >
            Add your first {activeTab.label.slice(0, -1).toLowerCase()}
          </button>
        </div>
      ) : (
        <div className="settings-items">
          {items.map((item) => (
            <div key={item.id} className="settings-item">
              <div className="settings-item-info">
                <h3 className="settings-item-name">{item.name}</h3>
                {item.description && (
                  <p className="settings-item-description">{item.description}</p>
                )}
              </div>
              <div className="settings-item-actions">
                <button
                  className="action-btn action-btn-edit"
                  onClick={() => handleEdit(item)}
                  aria-label={`Edit ${item.name}`}
                  title="Edit"
                >
                  <Edit />
                </button>
                <button
                  className="action-btn action-btn-delete"
                  onClick={() => handleDelete(item.id)}
                  aria-label={`Delete ${item.name}`}
                  title="Delete"
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
        title={editingItem ? `Edit ${activeTab.label.slice(0, -1)}` : `Add ${activeTab.label.slice(0, -1)}`}
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
          <div className="form-field">
            <label htmlFor="item-description">Description (optional)</label>
            <textarea
              id="item-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder={`Brief description of this ${activeTab.label.slice(0, -1).toLowerCase()}`}
              rows={3}
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

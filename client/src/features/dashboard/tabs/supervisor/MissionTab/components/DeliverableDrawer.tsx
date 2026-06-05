import { useEffect, useState, type FormEvent } from 'react'

import { DashboardButton } from '@/features/dashboard/components/DashboardButton'
import { Drawer } from '@/features/dashboard/components/Drawer/Drawer'
import type { ToastTone } from '@/features/dashboard/components/Toast/useToast'
import type {
  CreateDeliverableRequest,
  SupervisorDeliverable,
  UpdateDeliverableRequest,
} from '@/features/dashboard/types/supervisorDashboard'
import { useI18n } from '@/locales/I18nContext'

interface DeliverableDrawerMissionIntern {
  internId: string
  internName: string
}

interface DeliverableDrawerProps {
  isOpen: boolean
  mode: 'create' | 'edit'
  missionId: string
  defaultInternId?: string
  deliverable?: SupervisorDeliverable | null
  /**
   * When provided in `create` mode, the drawer renders an intern picker so
   * supervisors can choose the assignee. When omitted (or in `edit` mode),
   * `defaultInternId` is used as-is for the create payload — preserving the
   * original single-mission usage from the Mission tab.
   */
  missionInterns?: DeliverableDrawerMissionIntern[]
  onClose: () => void
  createDeliverable: (req: CreateDeliverableRequest) => Promise<void>
  updateDeliverable: (id: string, req: UpdateDeliverableRequest) => Promise<void>
  showToast: (message: string, tone: ToastTone) => void
}

interface FormValues {
  internId: string
  title: string
  description: string
  dueDate: string
  // TODO: weight field removed from UI — backend + DTO cleanup tracked separately (Task 2)
  weight: string
}

interface FormErrors {
  internId?: string
  title?: string
  // TODO: weight field removed from UI — backend + DTO cleanup tracked separately (Task 2)
  weight?: string
}

const emptyFormValues: FormValues = {
  internId: '',
  title: '',
  description: '',
  dueDate: '',
  weight: '0',
}

function toDateInputValue(value: string | null | undefined): string {
  if (!value) {
    return ''
  }

  const isoDateMatch = /^\d{4}-\d{2}-\d{2}/.exec(value)
  if (isoDateMatch) {
    return isoDateMatch[0]
  }

  const parsedDate = new Date(value)
  if (Number.isNaN(parsedDate.getTime())) {
    return ''
  }

  return parsedDate.toISOString().slice(0, 10)
}

function valuesFromDeliverable(
  deliverable: SupervisorDeliverable | null | undefined,
  defaultInternId: string,
): FormValues {
  if (!deliverable) {
    return { ...emptyFormValues, internId: defaultInternId }
  }

  return {
    internId: deliverable.internId ?? defaultInternId,
    title: deliverable.title ?? '',
    description: deliverable.description ?? '',
    dueDate: toDateInputValue(deliverable.dueDate),
    weight: String(deliverable.weight ?? 0),
  }
}

export function DeliverableDrawer({
  isOpen,
  mode,
  missionId,
  defaultInternId,
  deliverable,
  missionInterns,
  onClose,
  createDeliverable,
  updateDeliverable,
  showToast,
}: DeliverableDrawerProps) {
  const { t } = useI18n()
  const [formValues, setFormValues] = useState<FormValues>(emptyFormValues)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const showInternPicker = mode === 'create' && Array.isArray(missionInterns) && missionInterns.length > 0

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setFormErrors({})
    setFormValues(valuesFromDeliverable(deliverable, defaultInternId ?? ''))
  }, [deliverable, defaultInternId, isOpen])

  const handleFieldChange = (field: keyof FormValues, value: string) => {
    setFormValues((previous) => ({ ...previous, [field]: value }))

    if (field === 'title' && formErrors.title) {
      setFormErrors((previous) => ({ ...previous, title: undefined }))
    }

    if (field === 'weight' && formErrors.weight) {
      setFormErrors((previous) => ({ ...previous, weight: undefined }))
    }

    if (field === 'internId' && formErrors.internId) {
      setFormErrors((previous) => ({ ...previous, internId: undefined }))
    }
  }

  const validateForm = (): boolean => {
    const nextErrors: FormErrors = {}
    const trimmedTitle = formValues.title.trim()
    const parsedWeight = Number.parseFloat(formValues.weight)

    if (!trimmedTitle) {
      nextErrors.title = t('dashboard.supervisor.deliverableDrawer.titleRequired')
    }

    // Weight is local-only today (see Step 2 note in handleSubmit) but the
    // input is still validated so the UX behaves consistently when the
    // backend eventually accepts it.
    if (!Number.isFinite(parsedWeight) || parsedWeight < 0 || parsedWeight > 100) {
      nextErrors.weight = t('dashboard.supervisor.deliverableDrawer.weightInvalid')
    }

    if (showInternPicker && !formValues.internId) {
      nextErrors.internId = t('dashboard.supervisor.taskDrawer.titleRequired')
    }

    setFormErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!validateForm()) {
      return
    }

    const trimmedTitle = formValues.title.trim()
    const trimmedDescription = formValues.description.trim()

    setIsSubmitting(true)
    try {
      if (mode === 'create') {
        // Backend `AssignDeliverableRequest` requires `InternId` (non-empty Guid).
        // When the drawer renders the intern picker we use the picked value;
        // otherwise we fall back to the parent-provided `defaultInternId`.
        // If both are empty the API returns a validation error which surfaces
        // through the existing error toast below.
        // `Weight` is NOT sent: the backend create endpoint ignores it today,
        // so the form value is kept local-only and the integration report
        // tracks this as a Step 2 follow-up.
        const resolvedInternId = showInternPicker ? formValues.internId : (defaultInternId ?? '')
        const request: CreateDeliverableRequest = {
          MissionId: missionId,
          InternId: resolvedInternId,
          Title: trimmedTitle,
          ...(trimmedDescription ? { Description: trimmedDescription } : {}),
          ...(formValues.dueDate ? { DueDate: formValues.dueDate } : { DueDate: null }),
        }

        await createDeliverable(request)
      } else if (deliverable) {
        // Step 2: `PUT/PATCH /api/deliverables/{id}` does not exist yet.
        // `updateDeliverable` throws `NotImplementedOnBackendError`, which the
        // existing catch below translates into the generic error toast. The
        // drawer stays open so the user can close it manually.
        const request: UpdateDeliverableRequest = {
          Title: trimmedTitle,
          ...(trimmedDescription ? { Description: trimmedDescription } : { Description: '' }),
          ...(formValues.dueDate ? { DueDate: formValues.dueDate } : { DueDate: null }),
        }

        await updateDeliverable(deliverable.id, request)
      }

      showToast(t('dashboard.supervisor.toast.saveSuccess'), 'success')
      onClose()
    } catch {
      showToast(t('dashboard.supervisor.error.save'), 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const drawerTitle =
    mode === 'create'
      ? t('dashboard.supervisor.deliverableDrawer.createTitle')
      : t('dashboard.supervisor.deliverableDrawer.editTitle')

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={drawerTitle}
      width="md"
      footer={(
        <div className="deliverable-form-footer">
          <DashboardButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t('dashboard.form.cancel')}
          </DashboardButton>
          <DashboardButton
            type="submit"
            variant="primary"
            size="sm"
            form="deliverable-drawer-form"
            loading={isSubmitting}
          >
            {t('dashboard.form.save')}
          </DashboardButton>
        </div>
      )}
    >
      <form id="deliverable-drawer-form" className="deliverable-form-modal" onSubmit={handleSubmit}>
        <div className="deliverable-form-body">
          {showInternPicker && (
            <div className="deliverable-form-field">
              <label htmlFor="deliverable-drawer-intern" className="deliverable-form-label">
                {t('dashboard.supervisor.taskDrawer.intern')}
              </label>
              <div className="deliverable-form-select-wrapper">
                <select
                  id="deliverable-drawer-intern"
                  className="deliverable-form-select"
                  value={formValues.internId}
                  onChange={(event) => handleFieldChange('internId', event.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="" disabled>
                    {t('dashboard.supervisor.taskDrawer.selectIntern')}
                  </option>
                  {missionInterns?.map((intern) => (
                    <option key={intern.internId} value={intern.internId}>
                      {intern.internName}
                    </option>
                  ))}
                </select>
              </div>
              {formErrors.internId && <p className="form-error">{formErrors.internId}</p>}
            </div>
          )}

          <div className="deliverable-form-field">
            <label htmlFor="deliverable-drawer-title" className="deliverable-form-label">
              {t('dashboard.form.title')}
            </label>
            <input
              id="deliverable-drawer-title"
              type="text"
              className="deliverable-form-input"
              value={formValues.title}
              onChange={(event) => handleFieldChange('title', event.target.value)}
              disabled={isSubmitting}
            />
            {formErrors.title && <p className="form-error">{formErrors.title}</p>}
          </div>

          <div className="deliverable-form-field">
            <label htmlFor="deliverable-drawer-description" className="deliverable-form-label">
              {t('dashboard.form.description')}
              <span className="deliverable-form-optional">optional</span>
            </label>
            <textarea
              id="deliverable-drawer-description"
              className="deliverable-form-textarea"
              rows={3}
              value={formValues.description}
              onChange={(event) => handleFieldChange('description', event.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="deliverable-form-field">
            <label htmlFor="deliverable-drawer-due-date" className="deliverable-form-label">
              {t('dashboard.form.dueDate')}
              <span className="deliverable-form-optional">optional</span>
            </label>
            <input
              id="deliverable-drawer-due-date"
              type="date"
              className="deliverable-form-input"
              value={formValues.dueDate}
              onChange={(event) => handleFieldChange('dueDate', event.target.value)}
              disabled={isSubmitting}
            />
          </div>
        </div>
      </form>
    </Drawer>
  )
}

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

interface DeliverableDrawerProps {
  isOpen: boolean
  mode: 'create' | 'edit'
  missionId: string
  defaultInternId?: string
  deliverable?: SupervisorDeliverable | null
  onClose: () => void
  createDeliverable: (req: CreateDeliverableRequest) => Promise<void>
  updateDeliverable: (id: string, req: UpdateDeliverableRequest) => Promise<void>
  showToast: (message: string, tone: ToastTone) => void
}

interface FormValues {
  title: string
  description: string
  dueDate: string
  weight: string
}

interface FormErrors {
  title?: string
  weight?: string
}

const emptyFormValues: FormValues = {
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

function valuesFromDeliverable(deliverable: SupervisorDeliverable | null | undefined): FormValues {
  if (!deliverable) {
    return { ...emptyFormValues }
  }

  return {
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
  onClose,
  createDeliverable,
  updateDeliverable,
  showToast,
}: DeliverableDrawerProps) {
  const { t } = useI18n()
  const [formValues, setFormValues] = useState<FormValues>(emptyFormValues)
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      return
    }

    setFormErrors({})
    setFormValues(valuesFromDeliverable(deliverable))
  }, [deliverable, isOpen])

  const handleFieldChange = (field: keyof FormValues, value: string) => {
    setFormValues((previous) => ({ ...previous, [field]: value }))

    if (field === 'title' && formErrors.title) {
      setFormErrors((previous) => ({ ...previous, title: undefined }))
    }

    if (field === 'weight' && formErrors.weight) {
      setFormErrors((previous) => ({ ...previous, weight: undefined }))
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
        // When the mission has no intern assigned yet, `defaultInternId` is empty
        // and the API will reject the request with a clear validation error,
        // which surfaces through the existing error toast below.
        // `Weight` is NOT sent: the backend create endpoint ignores it today,
        // so the form value is kept local-only and the integration report
        // tracks this as a Step 2 follow-up.
        const request: CreateDeliverableRequest = {
          MissionId: missionId,
          InternId: defaultInternId ?? '',
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
        <div className="mission-drawer-footer">
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
      <form id="deliverable-drawer-form" className="mission-drawer-form" onSubmit={handleSubmit}>
        <label className="mission-form-field" htmlFor="deliverable-drawer-title">
          <span>{t('dashboard.form.title')}</span>
          <input
            id="deliverable-drawer-title"
            type="text"
            className="dash-input"
            value={formValues.title}
            onChange={(event) => handleFieldChange('title', event.target.value)}
            disabled={isSubmitting}
          />
          {formErrors.title && <p className="form-error">{formErrors.title}</p>}
        </label>

        <label className="mission-form-field" htmlFor="deliverable-drawer-description">
          <span>{t('dashboard.form.description')}</span>
          <textarea
            id="deliverable-drawer-description"
            className="dash-textarea"
            rows={4}
            value={formValues.description}
            onChange={(event) => handleFieldChange('description', event.target.value)}
            disabled={isSubmitting}
          />
        </label>

        <label className="mission-form-field" htmlFor="deliverable-drawer-due-date">
          <span>{t('dashboard.form.dueDate')}</span>
          <input
            id="deliverable-drawer-due-date"
            type="date"
            className="dash-input"
            value={formValues.dueDate}
            onChange={(event) => handleFieldChange('dueDate', event.target.value)}
            disabled={isSubmitting}
          />
        </label>

        <label className="mission-form-field" htmlFor="deliverable-drawer-weight">
          <span>{t('dashboard.supervisor.deliverableDrawer.weight')}</span>
          <span className="mission-percent-input">
            <input
              id="deliverable-drawer-weight"
              type="number"
              className="dash-input"
              min={0}
              max={100}
              value={formValues.weight}
              onChange={(event) => handleFieldChange('weight', event.target.value)}
              disabled={isSubmitting}
            />
            <span aria-hidden="true">%</span>
          </span>
          {formErrors.weight && <p className="form-error">{formErrors.weight}</p>}
        </label>
      </form>
    </Drawer>
  )
}

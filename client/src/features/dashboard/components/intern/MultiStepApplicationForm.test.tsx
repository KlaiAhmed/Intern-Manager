import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { MultiStepApplicationForm } from './MultiStepApplicationForm'
import { PendingStatusView } from './InternStatusViews'

const mockApi = {
  get: vi.fn(),
  postFormData: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}

vi.mock('../../hooks/useDashboardApi', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useDashboardApi')>('../../hooks/useDashboardApi')
  return {
    ...actual,
    useDashboardApi: () => mockApi,
  }
})

vi.mock('../../../../locales/I18nContext', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string) => key,
  }),
}))

const school = { id: 'school-1', name: 'Axia University' }
const futureGraduationDate = '2099-06-01'
const futureStartDate = '2099-01-01'
const futureEndDate = '2099-02-01'

const fillStep1 = async (phoneNumber = '') => {
  await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(1))
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Select your university' })).toBeInTheDocument()
  })

  const selectTrigger = screen.getByRole('button', { name: 'Select your university' })
  fireEvent.click(selectTrigger)
  fireEvent.click(screen.getByRole('option', { name: school.name }))

  fireEvent.change(screen.getByLabelText('dashboard.intern.application.major'), {
    target: { value: 'Computer Science' },
  })

  fireEvent.change(screen.getByLabelText('dashboard.intern.application.expectedGraduation'), {
    target: { value: futureGraduationDate },
  })

  fireEvent.change(screen.getByLabelText('dashboard.intern.application.availableStart'), {
    target: { value: futureStartDate },
  })

  fireEvent.change(screen.getByLabelText('dashboard.intern.application.availableEnd'), {
    target: { value: futureEndDate },
  })

  if (phoneNumber) {
    fireEvent.change(screen.getByLabelText('dashboard.intern.application.phoneNumber'), {
      target: { value: phoneNumber },
    })
  }

  fireEvent.click(screen.getByRole('button', { name: 'dashboard.intern.application.next' }))
}

const fillStep2 = async (container: HTMLElement) => {
  const fileInput = container.querySelector('#cv-upload-input') as HTMLInputElement | null
  expect(fileInput).not.toBeNull()

  const file = new File(['resume'], 'cv.pdf', { type: 'application/pdf' })
  fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } })

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'dashboard.intern.application.next' })).toBeEnabled()
  })

  fireEvent.click(screen.getByRole('button', { name: 'dashboard.intern.application.next' }))
}

describe('MultiStepApplicationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApi.get.mockResolvedValue([school])
    mockApi.postFormData.mockResolvedValue({})
  })

  it('loads schools once on mount and stabilizes the selector', async () => {
    render(<MultiStepApplicationForm onSubmitted={vi.fn()} />)

    await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(1))
    expect(mockApi.get).toHaveBeenCalledWith('/api/intern/me/profile/schools')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Select your university' })).toBeInTheDocument()
    })

    await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(1))
  })

  it('omits phone number when input is empty and keeps required fields intact', async () => {
    const { container } = render(<MultiStepApplicationForm onSubmitted={vi.fn()} />)

    await fillStep1()
    await fillStep2(container)

    fireEvent.click(screen.getByRole('button', { name: 'dashboard.intern.application.submit' }))

    await waitFor(() => expect(mockApi.postFormData).toHaveBeenCalledTimes(1))

    const submittedForm = mockApi.postFormData.mock.calls[0][1] as FormData

    expect(submittedForm.get('phoneNumber')).toBeNull()
    expect(submittedForm.get('universityId')).toBe(school.id)
    expect(submittedForm.get('major')).toBe('Computer Science')
    expect(submittedForm.get('startDate')).toBe(futureStartDate)
    expect(submittedForm.get('endDate')).toBe(futureEndDate)
  })

  it('submits a valid phone number with the country prefix', async () => {
    const { container } = render(<MultiStepApplicationForm onSubmitted={vi.fn()} />)

    await fillStep1('12345678')
    await fillStep2(container)

    fireEvent.click(screen.getByRole('button', { name: 'dashboard.intern.application.submit' }))

    await waitFor(() => expect(mockApi.postFormData).toHaveBeenCalledTimes(1))

    const submittedForm = mockApi.postFormData.mock.calls[0][1] as FormData
    expect(submittedForm.get('phoneNumber')).toBe('+21612345678')
  })
})

describe('PendingStatusView', () => {
  it('renders the stored phone number', () => {
    render(
      <PendingStatusView
        notificationMessage="Pending"
        profile={{ phoneNumber: '+21612345678' }}
      />,
    )

    expect(screen.getByText('+21612345678')).toBeInTheDocument()
  })
})

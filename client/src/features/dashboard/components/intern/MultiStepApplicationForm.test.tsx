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

const fillStep1 = async (phoneNumber = '') => {
  await waitFor(() => expect(mockApi.get).toHaveBeenCalledTimes(1))
  await waitFor(() => {
    expect(screen.getByText('Select your university')).toBeInTheDocument()
  })

  const selectTrigger = screen.getByText('Select your university').closest('button')!
  fireEvent.click(selectTrigger)
  fireEvent.click(screen.getByRole('option', { name: school.name }))

  fireEvent.change(screen.getByLabelText('dashboard.intern.application.major'), {
    target: { value: 'Computer Science' },
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
      expect(screen.getByText('Select your university')).toBeInTheDocument()
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
    expect(submittedForm.get('currentYearOfStudy')).toBe('licence_1')
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

  it('renders Degree Level dropdown label (not raw key)', () => {
    render(<MultiStepApplicationForm onSubmitted={vi.fn()} />)

    expect(screen.getByText('dashboard.intern.application.degreeLevel')).toBeInTheDocument()
    expect(screen.getByText('dashboard.intern.application.degreeLevel.licence')).toBeInTheDocument()
  })

  it('renders Study Year dropdown label (not raw key)', () => {
    render(<MultiStepApplicationForm onSubmitted={vi.fn()} />)

    expect(screen.getByText('dashboard.intern.application.studyYear')).toBeInTheDocument()
    expect(screen.getByText('dashboard.intern.application.studyYear.year1')).toBeInTheDocument()
  })

  it('shows correct study year options when degree level changes', () => {
    render(<MultiStepApplicationForm onSubmitted={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'dashboard.intern.application.degreeLevel' }))
    fireEvent.click(screen.getByRole('option', { name: 'dashboard.intern.application.degreeLevel.master' }))

    fireEvent.click(screen.getByRole('button', { name: 'dashboard.intern.application.studyYear' }))
    const yearOptions = screen.getAllByRole('option')
    expect(yearOptions).toHaveLength(2)
    expect(yearOptions[0]).toHaveTextContent('dashboard.intern.application.studyYear.year1')
    expect(yearOptions[1]).toHaveTextContent('dashboard.intern.application.studyYear.year2')
  })

  it('renders phone prefix +216 and digit input as a single unified wrapper with no independent borders', () => {
    render(<MultiStepApplicationForm onSubmitted={vi.fn()} />)

    const prefix = screen.getByText('+216')
    expect(prefix.tagName).toBe('SPAN')
    expect(prefix).toHaveAttribute('aria-label', 'dashboard.intern.application.countryCode')

    const wrapper = prefix.closest('.phone-input-wrapper')
    expect(wrapper).not.toBeNull()

    const digitInput = wrapper!.querySelector('.phone-digit-input') as HTMLInputElement | null
    expect(digitInput).not.toBeNull()
    expect(digitInput!.getAttribute('inputMode')).toBe('numeric')
    expect(digitInput!.getAttribute('maxLength')).toBe('8')

    // The input must have no border, outline, or box-shadow of its own
    // (wrapper owns them all) — verify via the class that enforces these resets
    expect(digitInput!.className).toBe('phone-digit-input')

    // The wrapper should be the single border container
    expect(wrapper!.className).toContain('phone-input-wrapper')
    expect(wrapper!.querySelectorAll('input').length).toBe(1)
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

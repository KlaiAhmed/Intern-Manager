import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

import { MeetingsTab } from './MeetingsTab'

const mockPost = vi.fn()
const mockPatch = vi.fn()
const mockDel = vi.fn()

const mockGet = vi.fn()
const mockCreateMeeting = vi.fn()

vi.mock('../../hooks/useDashboardApi', () => ({
  useDashboardApi: () => ({
    get: mockGet,
    post: mockPost,
    patch: mockPatch,
    put: vi.fn(),
    del: mockDel,
    postFormData: vi.fn(),
  }),
}))

vi.mock('@/locales/I18nContext', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    isRtl: false,
    isLoading: false,
    locale: 'en',
    setLocale: vi.fn(),
  }),
}))

// Stub the create-meeting form to keep the test focused on the tab's
// contract: it always invokes `onSubmit` with the latest `meetingForm`
// values, and surfaces `submitError`. The form's own UI is exercised
// by its sibling component tests.
vi.mock(
  '@/features/dashboard/components/supervisor/SupervisorMeetingForm',
  () => ({
    emptyMeetingFormValues: {
      internId: '',
      date: '',
      title: '',
      meetingUrl: '',
      note: '',
    },
    SupervisorMeetingForm: ({
      isOpen,
      isSubmitting,
      submitError,
      meetingFormError,
      onOpenChange,
      onFieldChange,
      onSubmit,
      meetingForm,
    }: {
      isOpen: boolean
      isSubmitting: boolean
      submitError: string | null
      meetingFormError: string | null
      onOpenChange: (open: boolean) => void
      onFieldChange: (field: string, value: string) => void
      onSubmit: () => Promise<void>
      meetingForm: {
        internId: string
        date: string
        title: string
        meetingUrl: string
        note: string
      }
    }) =>
      isOpen ? (
        <div data-testid="create-meeting-modal">
          <button
            type="button"
            data-testid="set-intern"
            onClick={() => onFieldChange('internId', 'intern-1')}
          >
            set intern
          </button>
          <button
            type="button"
            data-testid="set-date"
            onClick={() =>
              onFieldChange(
                'date',
                '2099-06-15T10:00',
              )
            }
          >
            set date
          </button>
          <button
            type="button"
            data-testid="set-title"
            onClick={() => onFieldChange('title', 'Weekly sync')}
          >
            set title
          </button>
          <button
            type="button"
            data-testid="set-url"
            onClick={() =>
              onFieldChange('meetingUrl', 'https://meet.example.com/abc')
            }
          >
            set url
          </button>
          <button
            type="button"
            data-testid="set-note"
            onClick={() => onFieldChange('note', 'Discuss progress')}
          >
            set note
          </button>
          <button type="button" data-testid="close" onClick={() => onOpenChange(false)}>
            close
          </button>
          <button
            type="button"
            data-testid="submit"
            disabled={isSubmitting}
            onClick={() => {
              void onSubmit()
            }}
          >
            submit
          </button>
          {meetingFormError && <p data-testid="form-error">{meetingFormError}</p>}
          {submitError && <p data-testid="submit-error">{submitError}</p>}
          <span data-testid="intern-id-value">{meetingForm.internId}</span>
        </div>
      ) : null,
  }),
)

// The tab wires the form's `onSubmit` to `createMeeting` from the data
// hook, which is responsible for the actual `POST /api/meetings` call.
// We assert against the captured request here.
vi.mock('./hooks/useMeetingsData', () => ({
  useMeetingsData: () => ({
    meetings: [],
    interns: [
      { id: 'intern-1', fullName: 'Alice Doe' },
      { id: 'intern-2', fullName: 'Bob Smith' },
    ],
    isLoading: false,
    error: null,
    refresh: vi.fn(async () => undefined),
    createMeeting: mockCreateMeeting,
    updateMeeting: vi.fn(),
    deleteMeeting: vi.fn(),
  }),
}))

function renderTab() {
  return render(<MeetingsTab />)
}

describe('MeetingsTab — create meeting flow', () => {
  beforeEach(() => {
    mockGet.mockReset()
    mockPost.mockReset()
    mockPatch.mockReset()
    mockDel.mockReset()
    mockCreateMeeting.mockReset()
    mockCreateMeeting.mockResolvedValue(undefined)
  })

  it('renders a Create Meeting button in the panel actions', () => {
    renderTab()
    const createButton = screen.getByRole('button', {
      name: /dashboard\.supervisor\.meetings\.create/,
    })
    expect(createButton).toBeInTheDocument()
  })

  it('opens the create modal when the Create Meeting button is clicked', () => {
    renderTab()
    const createButton = screen.getByRole('button', {
      name: /dashboard\.supervisor\.meetings\.create/,
    })
    fireEvent.click(createButton)
    expect(screen.getByTestId('create-meeting-modal')).toBeInTheDocument()
  })

  it('submits a payload that matches the API contract on valid input', async () => {
    renderTab()

    fireEvent.click(
      screen.getByRole('button', {
        name: /dashboard\.supervisor\.meetings\.create/,
      }),
    )

    fireEvent.click(screen.getByTestId('set-intern'))
    fireEvent.click(screen.getByTestId('set-date'))
    fireEvent.click(screen.getByTestId('set-title'))
    fireEvent.click(screen.getByTestId('set-url'))
    fireEvent.click(screen.getByTestId('set-note'))
    fireEvent.click(screen.getByTestId('submit'))

    await waitFor(() => {
      expect(mockCreateMeeting).toHaveBeenCalledTimes(1)
    })

    const requestArg = mockCreateMeeting.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined
    expect(requestArg).toBeDefined()

    // Shape: InternId/Date are required; Title/MeetingUrl/Notes are optional
    // and only included when the user supplied a non-empty value.
    expect(requestArg).toMatchObject({
      InternId: 'intern-1',
      Title: 'Weekly sync',
      MeetingUrl: 'https://meet.example.com/abc',
      Notes: 'Discuss progress',
    })
    // Date is sent as a UTC ISO string regardless of the user's local
    // datetime-local selection. '2099-06-15T10:00' (local) → ISO with 'Z'.
    const dateValue = requestArg?.Date as string
    expect(typeof dateValue).toBe('string')
    expect(dateValue).toMatch(/Z$/)
    expect(new Date(dateValue).toISOString()).toBe(dateValue)
  })

  it('omits optional fields when the user leaves them blank', async () => {
    renderTab()

    fireEvent.click(
      screen.getByRole('button', {
        name: /dashboard\.supervisor\.meetings\.create/,
      }),
    )

    // Only intern + date are required; the rest stay empty.
    fireEvent.click(screen.getByTestId('set-intern'))
    fireEvent.click(screen.getByTestId('set-date'))
    fireEvent.click(screen.getByTestId('submit'))

    await waitFor(() => {
      expect(mockCreateMeeting).toHaveBeenCalledTimes(1)
    })

    const requestArg = mockCreateMeeting.mock.calls[0]?.[0] as
      | Record<string, unknown>
      | undefined
    expect(requestArg).toBeDefined()
    expect(Object.prototype.hasOwnProperty.call(requestArg, 'Title')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(requestArg, 'MeetingUrl')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(requestArg, 'Notes')).toBe(false)
    expect(requestArg?.InternId).toBe('intern-1')
  })

  it('rejects submission when no intern is selected', async () => {
    renderTab()

    fireEvent.click(
      screen.getByRole('button', {
        name: /dashboard\.supervisor\.meetings\.create/,
      }),
    )

    // Set a valid date but leave the intern selection empty.
    fireEvent.click(screen.getByTestId('set-date'))
    fireEvent.click(screen.getByTestId('submit'))

    await waitFor(() => {
      expect(
        screen.getByTestId('form-error').textContent,
      ).toMatch(/internRequired/)
    })
    expect(mockCreateMeeting).not.toHaveBeenCalled()
  })

  it('rejects submission when the date is missing', async () => {
    renderTab()

    fireEvent.click(
      screen.getByRole('button', {
        name: /dashboard\.supervisor\.meetings\.create/,
      }),
    )

    fireEvent.click(screen.getByTestId('set-intern'))
    fireEvent.click(screen.getByTestId('submit'))

    await waitFor(() => {
      expect(
        screen.getByTestId('form-error').textContent,
      ).toMatch(/dateRequired/)
    })
    expect(mockCreateMeeting).not.toHaveBeenCalled()
  })

  it('surfaces API errors in the modal without closing it', async () => {
    mockCreateMeeting.mockRejectedValueOnce(
      new Error('Meeting slot conflicts with an existing meeting.'),
    )

    renderTab()

    fireEvent.click(
      screen.getByRole('button', {
        name: /dashboard\.supervisor\.meetings\.create/,
      }),
    )
    fireEvent.click(screen.getByTestId('set-intern'))
    fireEvent.click(screen.getByTestId('set-date'))
    fireEvent.click(screen.getByTestId('submit'))

    await waitFor(() => {
      expect(
        screen.getByTestId('submit-error').textContent,
      ).toMatch(/conflicts with an existing meeting/)
    })
    // The modal must stay open so the user can correct the input.
    expect(screen.getByTestId('create-meeting-modal')).toBeInTheDocument()
  })

  it('closes the modal after a successful create', async () => {
    renderTab()

    fireEvent.click(
      screen.getByRole('button', {
        name: /dashboard\.supervisor\.meetings\.create/,
      }),
    )
    expect(screen.getByTestId('create-meeting-modal')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('set-intern'))
    fireEvent.click(screen.getByTestId('set-date'))
    fireEvent.click(screen.getByTestId('submit'))

    await waitFor(() => {
      expect(mockCreateMeeting).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(screen.queryByTestId('create-meeting-modal')).not.toBeInTheDocument()
    })
  })
})

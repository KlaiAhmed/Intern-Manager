import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { NotificationBell } from './NotificationBell'
import { useNotifications } from '../hooks/useNotifications'

vi.mock('../../../locales/I18nContext', () => ({
  useI18n: () => ({
    locale: 'en',
    t: (key: string) => {
      const labels: Record<string, string> = {
        'notifications.aria.toggle': 'Toggle notifications',
        'notifications.title': 'Notifications',
        'notifications.markAllRead': 'Mark all as read',
        'notifications.loading': 'Loading notifications',
        'notifications.empty': 'No notifications',
        'notifications.viewAll': 'View all',
      }

      return labels[key] ?? key
    },
  }),
}))

vi.mock('../hooks/useNotifications', () => ({
  useNotifications: vi.fn(),
}))

const mockedUseNotifications = vi.mocked(useNotifications)

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationBell role="intern" />
    </MemoryRouter>,
  )
}

describe('NotificationBell', () => {
  it('shows unread count badge when unread notifications exist', () => {
    mockedUseNotifications.mockReturnValue({
      notifications: [],
      unreadCount: 2,
      markAllRead: vi.fn().mockResolvedValue(undefined),
      markRead: vi.fn().mockResolvedValue(undefined),
      isLoading: false,
    })

    renderBell()

    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('marks a notification as read when an unread item is clicked', async () => {
    const markRead = vi.fn().mockResolvedValue(undefined)

    mockedUseNotifications.mockReturnValue({
      notifications: [
        {
          id: '1',
          type: 'EvaluationReleased',
          title: 'Evaluation update',
          message: 'Evaluation released',
          relatedEntity: null,
          isRead: false,
          createdAt: new Date().toISOString(),
          readAt: null,
        },
      ],
      unreadCount: 1,
      markAllRead: vi.fn().mockResolvedValue(undefined),
      markRead,
      isLoading: false,
    })

    renderBell()

    fireEvent.click(screen.getByRole('button', { name: 'Toggle notifications' }))
    fireEvent.click(screen.getByText('Evaluation released'))

    await waitFor(() => {
      expect(markRead).toHaveBeenCalledWith('1')
    })
  })
})

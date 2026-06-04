import { memo } from 'react'
import type { ToastItem } from './useToast'
import './Toast.css'

interface ToastProps {
  toasts: ToastItem[]
  onDismiss: (id: string) => void
}

export const Toast = memo(function Toast({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="dashboard-toast-container" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`dashboard-toast dashboard-toast--${toast.tone}`}>
          <p className="dashboard-toast__message">{toast.message}</p>
          <button
            className="dashboard-toast__dismiss"
            type="button"
            aria-label="Dismiss notification"
            onClick={() => onDismiss(toast.id)}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  )
})

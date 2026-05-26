import type { PropsWithChildren } from 'react'
import { useEffect, useRef } from 'react'
import { useI18n } from '../../../locales/I18nContext'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  hideHeader?: boolean
}

/**
 * Modal/dialog réutilisable avec gestion du focus et de l'accessibilité.
 */
export function Modal({ isOpen, onClose, title, hideHeader, children }: PropsWithChildren<ModalProps>) {
  const { t } = useI18n()
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      contentRef.current?.focus()
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      ref={overlayRef}
      className="modal-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={contentRef}
        className="modal-content"
        tabIndex={-1}
      >
        {!hideHeader && (
          <div className="modal-header">
            <h2 id="modal-title" className="modal-title">{title}</h2>
            <button
              type="button"
              className="modal-close-button"
              onClick={onClose}
              aria-label={t('dashboard.form.close')}
            >
              ✕
            </button>
          </div>
        )}
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  )
}


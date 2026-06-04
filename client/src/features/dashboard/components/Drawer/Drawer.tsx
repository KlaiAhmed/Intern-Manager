import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef } from 'react'
import { DashboardButton } from '../DashboardButton'

type DrawerWidth = 'md' | 'lg'

export interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title: string
  width?: DrawerWidth
  children: ReactNode
  footer?: ReactNode
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button',
  'input',
  'textarea',
  'select',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function getFocusableElements(container: HTMLElement | null) {
  if (!container) {
    return []
  }

  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    const isDisabled = element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true'
    return !isDisabled && element.offsetParent !== null
  })
}

export function Drawer({
  isOpen,
  onClose,
  title,
  width = 'md',
  children,
  footer,
}: DrawerProps) {
  const reactId = useId()
  const titleId = `drawer-title-${reactId}`
  const panelRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      previouslyFocusedElementRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

      const focusableElements = getFocusableElements(panelRef.current)
      const firstFocusableElement = focusableElements[0] ?? panelRef.current
      firstFocusableElement?.focus()
    }

    if (!isOpen && wasOpenRef.current) {
      previouslyFocusedElementRef.current?.focus()
      previouslyFocusedElementRef.current = null
    }

    wasOpenRef.current = isOpen
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const focusableElements = getFocusableElements(panelRef.current)
      if (focusableElements.length === 0) {
        event.preventDefault()
        panelRef.current?.focus()
        return
      }

      const firstFocusableElement = focusableElements[0]
      const lastFocusableElement = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement

      if (event.shiftKey && activeElement === firstFocusableElement) {
        event.preventDefault()
        lastFocusableElement.focus()
      }

      if (!event.shiftKey && activeElement === lastFocusableElement) {
        event.preventDefault()
        firstFocusableElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleOverlayClick = () => {
    onClose()
  }

  const handlePanelClick = (event: KeyboardEvent<HTMLDivElement>) => {
    event.stopPropagation()
  }

  return (
    <>
      <div
        className="drawer-overlay"
        data-open={isOpen}
        onClick={handleOverlayClick}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        className={`drawer-panel drawer-panel--${width}`}
        data-open={isOpen}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handlePanelClick}
      >
        <div className="drawer-header">
          <h2 id={titleId} className="drawer-title">{title}</h2>
          <DashboardButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close drawer"
          >
            ×
          </DashboardButton>
        </div>
        <div className="drawer-body">
          {children}
        </div>
        {footer && (
          <div className="drawer-footer">
            {footer}
          </div>
        )}
      </div>
    </>
  )
}

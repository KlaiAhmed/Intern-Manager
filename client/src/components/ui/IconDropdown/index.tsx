import { useEffect, useRef, useState, type ReactNode } from 'react'
import { classNames } from '../../../utils/classNames'

type IconDropdownOption<T extends string> = {
  value: T
  label: string
}

type IconDropdownProps<T extends string> = {
  ariaLabel: string
  title: string
  icon: ReactNode
  valueText: string
  options: Array<IconDropdownOption<T>>
  selectedValue: T
  onSelect: (value: T) => void
  shouldClose?: boolean
}

export function IconDropdown<T extends string>({
  ariaLabel,
  title,
  icon,
  valueText,
  options,
  selectedValue,
  onSelect,
  shouldClose = false,
}: IconDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false)
  const [isOpenUpward, setIsOpenUpward] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (shouldClose) {
      const closeTimer = window.setTimeout(() => {
        setIsOpen(false)
      }, 0)

      return () => {
        window.clearTimeout(closeTimer)
      }
    }

    return undefined
  }, [shouldClose])

  useEffect(() => {
    // Ferme le menu si l'utilisateur clique en dehors du composant.
    const onPointerDown = (event: MouseEvent): void => {
      if (!containerRef.current) {
        return
      }

      const target = event.target
      if (!(target instanceof Node)) {
        return
      }

      if (!containerRef.current.contains(target)) {
        setIsOpen(false)
      }
    }

    const onEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onEscape)

    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onEscape)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    // Ouvre le menu vers le haut si l'espace sous le trigger est trop petit.
    const updateMenuDirection = (): void => {
      if (!containerRef.current) {
        return
      }

      const estimatedMenuHeight = options.length * 36 + 20
      const rect = containerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top

      setIsOpenUpward(spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow)
    }

    updateMenuDirection()
    window.addEventListener('resize', updateMenuDirection)

    return () => {
      window.removeEventListener('resize', updateMenuDirection)
    }
  }, [isOpen, options.length])

  return (
    <div
      ref={containerRef}
      className={classNames('icon-control-dropdown', isOpen && 'is-open', isOpenUpward && 'open-up')}
    >
      <button
        type="button"
        className="icon-control"
        onClick={() => {
          setIsOpen((prevState) => {
            if (!prevState && containerRef.current) {
              const estimatedMenuHeight = options.length * 36 + 20
              const rect = containerRef.current.getBoundingClientRect()
              const spaceBelow = window.innerHeight - rect.bottom
              const spaceAbove = rect.top

              setIsOpenUpward(spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow)
            }

            return !prevState
          })
        }}
        aria-label={ariaLabel}
        title={title}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="icon-control-mark" aria-hidden="true">
          {icon}
        </span>
        <span className="icon-control-value">{valueText}</span>
      </button>

      {isOpen && (
        <div className="icon-control-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              className={classNames('icon-control-option', option.value === selectedValue && 'is-active')}
              role="option"
              aria-selected={option.value === selectedValue}
              onClick={() => {
                onSelect(option.value)
                setIsOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}




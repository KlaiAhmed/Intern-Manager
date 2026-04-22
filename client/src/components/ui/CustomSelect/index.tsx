import { useState, useRef, useEffect, type ChangeEvent, type KeyboardEvent } from 'react'

export interface SelectOption {
  value: string
  label: string
}

interface CustomSelectProps {
  id: string
  name: string
  value: string
  options: SelectOption[]
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  className?: string
  placeholder?: string
}

export function CustomSelect({
  id,
  name,
  value,
  options,
  onChange,
  disabled = false,
  className = '',
  placeholder = 'Select an option',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(opt => opt.value === value)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setHighlightedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

useEffect(() => {
  if (isOpen) {
    setHighlightedIndex(-1) // eslint-disable-line react-hooks/set-state-in-effect -- Intentional: reset highlight when opening dropdown
  }
}, [isOpen])

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
    }
  }

  const handleSelect = (optionValue: string) => {
    const event = {
      target: {
        name,
        value: optionValue,
      },
    } as ChangeEvent<HTMLInputElement>

    onChange(event)
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return

    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault()
        if (isOpen && highlightedIndex >= 0) {
          handleSelect(options[highlightedIndex].value)
        } else {
          setIsOpen(!isOpen)
        }
        break
      case 'ArrowDown':
        e.preventDefault()
        if (!isOpen) {
          setIsOpen(true)
          setHighlightedIndex(0)
        } else {
          setHighlightedIndex(prev => (prev < options.length - 1 ? prev + 1 : prev))
        }
        break
      case 'ArrowUp':
        e.preventDefault()
        if (isOpen) {
          setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0))
        }
        break
      case 'Escape':
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
      case 'Tab':
        setIsOpen(false)
        setHighlightedIndex(-1)
        break
    }
  }

  return (
    <div
      ref={containerRef}
      className={`custom-select ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''} ${className}`}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        id={id}
        className="custom-select-trigger"
        onClick={handleToggle}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby={`${id}-label`}
      >
        <span className="custom-select-value">
          {selectedOption?.label || placeholder}
        </span>
        <svg
          className="custom-select-chevron"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M4 6L8 10L12 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          className="custom-select-dropdown"
          role="listbox"
          aria-labelledby={id}
          tabIndex={-1}
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              className={`custom-select-option ${option.value === value ? 'selected' : ''} ${index === highlightedIndex ? 'highlighted' : ''}`}
              onClick={() => handleSelect(option.value)}
              role="option"
              aria-selected={option.value === value}
              tabIndex={-1}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <input type="hidden" name={name} value={value} />
    </div>
  )
}

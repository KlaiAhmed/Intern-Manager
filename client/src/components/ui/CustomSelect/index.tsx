import { useState, useRef, useEffect, type ChangeEvent, type KeyboardEvent } from 'react'
import './index.module.css'

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
}

export function CustomSelect({
  id,
  name,
  value,
  options,
  onChange,
  disabled = false,
  className = '',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(opt => opt.value === value)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
      >
        <span className="custom-select-value">{selectedOption?.label || ''}</span>
        <svg
          className="custom-select-chevron"
          width="12"
          height="8"
          viewBox="0 0 12 8"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M1 1.5L6 6.5L11 1.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <div className="custom-select-dropdown" role="listbox" aria-labelledby={id}>
        {options.map((option, index) => (
          <button
            key={option.value}
            type="button"
            className={`custom-select-option ${option.value === value ? 'selected' : ''} ${index === highlightedIndex ? 'highlighted' : ''}`}
            onClick={() => handleSelect(option.value)}
            role="option"
            aria-selected={option.value === value}
          >
            {option.label}
          </button>
        ))}
      </div>

      <input type="hidden" name={name} value={value} />
    </div>
  )
}

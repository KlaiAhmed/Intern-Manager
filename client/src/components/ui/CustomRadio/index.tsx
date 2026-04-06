import { type ChangeEvent } from 'react'
import './index.module.css'

interface RadioOption {
  value: string
  label: string
}

interface CustomRadioProps {
  name: string
  value: string
  options: RadioOption[]
  onChange: (e: ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  className?: string
}

export function CustomRadio({
  name,
  value,
  options,
  onChange,
  disabled = false,
  className = '',
}: CustomRadioProps) {
  return (
    <div className={`custom-radio-group ${disabled ? 'disabled' : ''} ${className}`}>
      {options.map(option => (
        <label key={option.value} className="custom-radio-label">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={onChange}
            disabled={disabled}
            className="custom-radio-input"
          />
          <span className="custom-radio-circle">
            <span className="custom-radio-dot" />
          </span>
          <span className="custom-radio-text">{option.label}</span>
        </label>
      ))}
    </div>
  )
}

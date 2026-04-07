import { type ChangeEvent } from 'react'

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
    <div
      className={`custom-radio-group ${disabled ? 'disabled' : ''} ${className}`}
      role="radiogroup"
    >
      {options.map((option) => (
        <label key={option.value} className="custom-radio-container">
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={onChange}
            disabled={disabled}
            className="custom-radio-input"
          />
          <span className="custom-radio-visual">
            <span className="custom-radio-outer">
              <span className="custom-radio-inner" />
            </span>
          </span>
          <span className="custom-radio-label-text">{option.label}</span>
        </label>
      ))}
    </div>
  )
}

import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import { classNames } from '../utils/classNames'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  type = 'button',
  ...buttonProps
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      {...buttonProps}
      type={type}
      className={classNames(
        'button',
        `button-${variant}`,
        `button-${size}`,
        fullWidth && 'button-full-width',
        className,
      )}
    >
      {children}
    </button>
  )
}

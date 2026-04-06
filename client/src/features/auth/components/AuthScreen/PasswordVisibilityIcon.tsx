interface PasswordVisibilityIconProps {
  isVisible: boolean
  className: string
}

export function PasswordVisibilityIcon({ isVisible, className }: PasswordVisibilityIconProps) {
  if (isVisible) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
        <path
          d="M3 3L21 21M10.58 10.58A2 2 0 0013.41 13.41M9.88 5.09A9.77 9.77 0 0112 4c5 0 9 4 10 8a11.8 11.8 0 01-3.32 5.07M6.1 6.1A11.76 11.76 0 002 12c1 4 5 8 10 8a9.77 9.77 0 005.33-1.66"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M2 12S6 4 12 4s10 8 10 8-4 8-10 8-10-8-10-8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

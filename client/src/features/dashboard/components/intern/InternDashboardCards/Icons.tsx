export const Icons = {
  user: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="intern-icon-md">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
    </svg>
  ),
  building: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="intern-icon-md">
      <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10z"/>
    </svg>
  ),
  upload: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="intern-icon-sm">
      <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
    </svg>
  ),
  comment: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="intern-icon-sm">
      <path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/>
    </svg>
  ),
  clock: () => (
    <svg viewBox="0 0 24 24" fill="currentColor" className="intern-icon-sm">
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
    </svg>
  ),
}

export function CircularProgress({ value, size = 128 }: { value: number; size?: number }) {
  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (value / 100) * circumference

  return (
    <div className="progress-ring-wrapper" style={{ width: size, height: size }}>
      <svg className="progress-ring-svg" viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <circle className="progress-ring-bg" cx={size / 2} cy={size / 2} r={radius} />
        <circle
          className="progress-ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className="progress-ring-value">{value}%</div>
      <div className="progress-ring-label">Complete</div>
    </div>
  )
}

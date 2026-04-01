import type { ReactNode } from 'react'
import './Panel.css'

interface PanelProps {
  title: string
  children: ReactNode
  actions?: ReactNode
  className?: string
}

/**
 * Panel — A section container for dashboard content
 * Clean, minimal borders with generous padding
 */
export function Panel({ title, children, actions, className = '' }: PanelProps) {
  return (
    <section className={`dash-panel ${className}`}>
      <header className="dash-panel-header">
        <h2 className="dash-panel-title">{title}</h2>
        {actions && <div className="dash-panel-actions">{actions}</div>}
      </header>
      <div className="dash-panel-content">
        {children}
      </div>
    </section>
  )
}

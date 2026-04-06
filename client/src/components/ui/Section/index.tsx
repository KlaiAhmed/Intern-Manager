import type { PropsWithChildren, ReactNode } from 'react'
import { classNames } from '../../../utils/classNames'

interface SectionProps {
  id?: string
  title?: string
  subtitle?: string
  titleAction?: ReactNode
  className?: string
}

export function Section({ id, title, subtitle, titleAction, className, children }: PropsWithChildren<SectionProps>) {
  return (
    <section id={id} className={classNames('section', 'reveal-on-scroll', className)} aria-labelledby={title ? `${id ?? 'section'}-title` : undefined}>
      <div className="container">
        {(title || subtitle || titleAction) && (
          <header className="section-header">
            <div className="section-heading-group">
              {title ? <h2 id={title ? `${id ?? 'section'}-title` : undefined}>{title}</h2> : null}
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
            {titleAction}
          </header>
        )}
        {children}
      </div>
    </section>
  )
}




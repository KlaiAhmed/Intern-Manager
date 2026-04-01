import type { CSSProperties, HTMLAttributes, PropsWithChildren } from 'react'
import { classNames } from '../utils/classNames'

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'article' | 'div'
  style?: CSSProperties & {
    '--reveal-delay'?: string
    [key: string]: string | number | undefined
  }
}

export function Card({ as = 'article', className, children, ...restProps }: PropsWithChildren<CardProps>) {
  const Component = as

  return (
    <Component {...restProps} className={classNames('surface-card', 'reveal-on-scroll', className)}>
      {children}
    </Component>
  )
}

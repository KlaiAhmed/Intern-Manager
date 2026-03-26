import type { HTMLAttributes, PropsWithChildren } from 'react'
import { classNames } from '../utils/classNames'

interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: 'article' | 'div'
}

export function Card({ as = 'article', className, children, ...restProps }: PropsWithChildren<CardProps>) {
  const Component = as

  return (
    <Component {...restProps} className={classNames('surface-card', className)}>
      {children}
    </Component>
  )
}

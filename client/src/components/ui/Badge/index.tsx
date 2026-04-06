import type { PropsWithChildren } from 'react'
import { classNames } from '../../../utils/classNames'

interface BadgeProps {
  className?: string
}

export function Badge({ children, className }: PropsWithChildren<BadgeProps>) {
  return <span className={classNames('badge', className)}>{children}</span>
}




import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'secondary' | 'destructive'
  children: ReactNode
}

export function Badge({ className, variant = 'secondary', children, ...props }: BadgeProps) {
  return (
    <span className={cn('ui-badge', `ui-badge-${variant}`, className)} {...props}>
      {children}
    </span>
  )
}

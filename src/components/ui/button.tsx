import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost'
  children: ReactNode
}

export function Button({ className, variant = 'default', children, ...props }: ButtonProps) {
  return (
    <button className={cn('ui-button', `ui-button-${variant}`, className)} type="button" {...props}>
      {children}
    </button>
  )
}

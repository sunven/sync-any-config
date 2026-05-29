import type { VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative w-full rounded-md border p-3 text-sm',
  {
    variants: {
      variant: {
        default: 'border-border bg-background text-foreground',
        destructive: 'border-destructive/35 bg-destructive/8 text-destructive',
        warning: 'border-warning/45 bg-warning/12 text-warning-foreground',
        success: 'border-success/35 bg-success/10 text-success-foreground',
        info: 'border-info/35 bg-info/10 text-info-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface AlertProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  return <div className={cn(alertVariants({ variant, className }))} role="alert" {...props} />
}

export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('mb-1 font-semibold leading-none tracking-normal', className)} {...props} />
}

export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm leading-relaxed [&_p]:leading-relaxed', className)} {...props} />
}

import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4',
  {
    variants: {
      variant: {
        default: 'bg-foreground text-white hover:bg-foreground/85',
        outline: 'border border-border bg-white hover:bg-muted',
        ghost: 'hover:bg-muted text-muted-foreground hover:text-foreground',
      },
      size: { default: 'h-10 px-4', sm: 'h-8 px-3', icon: 'size-10' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export function Button({
  className, variant, size, asChild = false, ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot : 'button'
  return <Component data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

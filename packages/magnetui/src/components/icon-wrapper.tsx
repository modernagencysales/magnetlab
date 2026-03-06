import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const iconWrapperVariants = cva('inline-flex items-center justify-center shrink-0 rounded-md', {
  variants: {
    size: {
      sm: 'h-7 w-7 [&>svg]:size-3.5',
      md: 'h-8 w-8 [&>svg]:size-4',
      lg: 'h-10 w-10 [&>svg]:size-5',
    },
    variant: {
      default: 'bg-muted text-muted-foreground',
      primary: 'bg-primary/10 text-primary',
      success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      error: 'bg-red-500/10 text-red-600 dark:text-red-400',
      info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    },
  },
  defaultVariants: {
    size: 'md',
    variant: 'default',
  },
});

export interface IconWrapperProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof iconWrapperVariants> {}

const IconWrapper = React.forwardRef<HTMLDivElement, IconWrapperProps>(
  ({ className, size, variant, ...props }, ref) => (
    <div ref={ref} className={cn(iconWrapperVariants({ size, variant, className }))} {...props} />
  )
);
IconWrapper.displayName = 'IconWrapper';

export { IconWrapper, iconWrapperVariants };

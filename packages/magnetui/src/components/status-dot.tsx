import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const statusDotVariants = cva('inline-block shrink-0 rounded-full', {
  variants: {
    status: {
      success: 'bg-emerald-500',
      warning: 'bg-amber-500',
      error: 'bg-red-500',
      info: 'bg-blue-500',
      neutral: 'bg-muted-foreground',
    },
    size: {
      sm: 'h-1.5 w-1.5',
      md: 'h-2 w-2',
      lg: 'h-2.5 w-2.5',
    },
    pulse: {
      true: 'animate-pulse',
      false: '',
    },
  },
  defaultVariants: {
    status: 'neutral',
    size: 'md',
    pulse: false,
  },
});

export interface StatusDotProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof statusDotVariants> {}

const StatusDot = React.forwardRef<HTMLSpanElement, StatusDotProps>(
  ({ className, status, size, pulse, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(statusDotVariants({ status, size, pulse, className }))}
      {...props}
    />
  )
);
StatusDot.displayName = 'StatusDot';

export { StatusDot, statusDotVariants };

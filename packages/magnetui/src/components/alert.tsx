'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const alertVariants = cva(
  'relative w-full rounded-lg border border-l-4 px-4 py-3 text-sm transition-colors [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg~*]:pl-7',
  {
    variants: {
      variant: {
        default: 'border-border border-l-border bg-background text-foreground',
        destructive:
          'border-destructive/30 border-l-destructive bg-destructive/5 text-foreground [&>svg]:text-destructive',
        warning:
          'border-[rgba(210,155,70,0.3)] border-l-[#C4975A] bg-[rgba(210,155,70,0.06)] text-foreground [&>svg]:text-[#A07840] dark:[&>svg]:text-[#D4B07A]',
        success:
          'border-[rgba(94,173,137,0.3)] border-l-[#6BB895] bg-[rgba(94,173,137,0.06)] text-foreground [&>svg]:text-[#4A8E6E] dark:[&>svg]:text-[#7ECAA8]',
        info:
          'border-[rgba(107,159,212,0.3)] border-l-[#7BAAD0] bg-[rgba(107,159,212,0.06)] text-foreground [&>svg]:text-[#5A85AE] dark:[&>svg]:text-[#8DB8E0]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
));
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn('mb-1 font-medium leading-none tracking-tight', className)}
      {...props}
    />
  )
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('text-sm [&_p]:leading-relaxed', className)} {...props} />
));
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription, alertVariants };

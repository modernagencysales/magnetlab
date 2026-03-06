'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Info, AlertTriangle, AlertCircle, CheckCircle, type LucideIcon } from 'lucide-react';
import { cn } from '../utils/cn';
import { iconSize, iconStrokeWidth } from '../tokens/spacing';

const calloutVariants = cva(
  'flex gap-3 rounded-lg border p-4 text-sm transition-colors',
  {
    variants: {
      variant: {
        info: 'border-[rgba(107,159,212,0.3)] bg-[rgba(107,159,212,0.06)] [&>svg]:text-[#5A85AE] dark:[&>svg]:text-[#8DB8E0]',
        warning:
          'border-[rgba(210,155,70,0.3)] bg-[rgba(210,155,70,0.06)] [&>svg]:text-[#A07840] dark:[&>svg]:text-[#D4B07A]',
        error:
          'border-destructive/30 bg-destructive/5 [&>svg]:text-destructive',
        success:
          'border-[rgba(94,173,137,0.3)] bg-[rgba(94,173,137,0.06)] [&>svg]:text-[#4A8E6E] dark:[&>svg]:text-[#7ECAA8]',
        default: 'border-border bg-muted/50',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const iconMap: Record<string, LucideIcon> = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle,
  default: Info,
};

export interface CalloutProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof calloutVariants> {
  icon?: LucideIcon;
  title?: string;
}

const Callout = React.forwardRef<HTMLDivElement, CalloutProps>(
  ({ className, variant = 'default', icon, title, children, ...props }, ref) => {
    const Icon = icon ?? iconMap[variant ?? 'default'];
    return (
      <div ref={ref} className={cn(calloutVariants({ variant }), className)} {...props}>
        <Icon size={iconSize.md} strokeWidth={iconStrokeWidth} className="mt-0.5 shrink-0" />
        <div className="flex-1">
          {title && <p className="mb-1 font-medium leading-none tracking-tight">{title}</p>}
          <div className="text-muted-foreground">{children}</div>
        </div>
      </div>
    );
  }
);
Callout.displayName = 'Callout';

export { Callout, calloutVariants };

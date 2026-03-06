import * as React from 'react';
import { cn } from '../utils/cn';

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Stat label */
  label: string;
  /** Main value */
  value: string | number;
  /** Optional description or change indicator */
  description?: React.ReactNode;
  /** Optional icon */
  icon?: React.ReactNode;
}

const StatCard = React.forwardRef<HTMLDivElement, StatCardProps>(
  ({ className, label, value, description, icon, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col gap-1 rounded-lg border bg-card p-4 text-card-foreground',
        className
      )}
      {...props}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {icon && <span className="text-muted-foreground [&>svg]:size-4">{icon}</span>}
      </div>
      <span className="text-2xl font-semibold tracking-tight">{value}</span>
      {description && <span className="text-xs text-muted-foreground">{description}</span>}
    </div>
  )
);
StatCard.displayName = 'StatCard';

export { StatCard };

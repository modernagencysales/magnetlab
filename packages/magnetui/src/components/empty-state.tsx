import * as React from 'react';
import { cn } from '../utils/cn';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Icon displayed above the title */
  icon?: React.ReactNode;
  /** Main heading */
  title: string;
  /** Description text */
  description?: string;
  /** Action button(s) */
  action?: React.ReactNode;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col items-center justify-center py-12 text-center', className)}
      {...props}
    >
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&>svg]:size-6">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
);
EmptyState.displayName = 'EmptyState';

export { EmptyState };

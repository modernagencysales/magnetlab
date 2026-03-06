import * as React from 'react';
import { cn } from '../utils/cn';

export interface PageTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Page heading */
  title: string;
  /** Optional subtitle / description */
  description?: string;
  /** Right-side actions (buttons, etc.) */
  actions?: React.ReactNode;
}

const PageTitle = React.forwardRef<HTMLDivElement, PageTitleProps>(
  ({ className, title, description, actions, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center justify-between gap-4', className)} {...props}>
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
);
PageTitle.displayName = 'PageTitle';

export { PageTitle };

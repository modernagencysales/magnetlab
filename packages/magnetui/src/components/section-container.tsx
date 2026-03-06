import * as React from 'react';
import { cn } from '../utils/cn';

export interface SectionContainerProps extends React.HTMLAttributes<HTMLElement> {
  /** Section title */
  title?: string;
  /** Section description */
  description?: string;
  /** Right-side header actions */
  actions?: React.ReactNode;
}

const SectionContainer = React.forwardRef<HTMLElement, SectionContainerProps>(
  ({ className, title, description, actions, children, ...props }, ref) => (
    <section ref={ref} className={cn('space-y-4', className)} {...props}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-4">
          <div>
            {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
);
SectionContainer.displayName = 'SectionContainer';

export { SectionContainer };

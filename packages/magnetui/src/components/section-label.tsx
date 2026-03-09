import * as React from 'react';
import { cn } from '../utils/cn';

export interface SectionLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional action element (button, link) shown to the right */
  action?: React.ReactNode;
}

const SectionLabel = React.forwardRef<HTMLDivElement, SectionLabelProps>(
  ({ className, children, action, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center justify-between px-2 py-1.5', className)}
      {...props}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {children}
      </span>
      {action && <span className="flex items-center">{action}</span>}
    </div>
  )
);
SectionLabel.displayName = 'SectionLabel';

export { SectionLabel };

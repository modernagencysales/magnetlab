import * as React from 'react';
import { cn } from '../utils/cn';

export interface InfoRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Left-side label */
  label: string;
  /** Whether to add bottom border */
  bordered?: boolean;
}

const InfoRow = React.forwardRef<HTMLDivElement, InfoRowProps>(
  ({ className, label, bordered = true, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-between gap-4 py-2.5 text-sm',
        bordered && 'border-b last:border-b-0',
        className
      )}
      {...props}
    >
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{children}</span>
    </div>
  )
);
InfoRow.displayName = 'InfoRow';

export { InfoRow };

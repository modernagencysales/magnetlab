import * as React from 'react';
import { cn } from '../utils/cn';

export interface SettingRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Setting label */
  label: string;
  /** Optional description below the label */
  description?: string;
  /** Right-side control (Switch, Select, Button, etc.) */
  action?: React.ReactNode;
}

const SettingRow = React.forwardRef<HTMLDivElement, SettingRowProps>(
  ({ className, label, description, action, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center justify-between gap-4 py-3', className)}
      {...props}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
        {children}
      </div>
      {action && <div className="flex shrink-0 items-center">{action}</div>}
    </div>
  )
);
SettingRow.displayName = 'SettingRow';

export { SettingRow };

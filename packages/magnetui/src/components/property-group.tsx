import * as React from 'react';
import { cn } from '../utils/cn';

export interface PropertyGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  /** Optional muted description below the value */
  description?: string;
}

const PropertyGroup = React.forwardRef<HTMLDivElement, PropertyGroupProps>(
  ({ className, label, description, children, ...props }, ref) => (
    <div ref={ref} className={cn('space-y-1', className)} {...props}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{children}</dd>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  )
);
PropertyGroup.displayName = 'PropertyGroup';

export { PropertyGroup };

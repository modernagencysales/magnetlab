import * as React from 'react';
import { cn } from '../utils/cn';

export type DotSeparatorProps = React.HTMLAttributes<HTMLSpanElement>;

const DotSeparator = React.forwardRef<HTMLSpanElement, DotSeparatorProps>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn('inline-block h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50', className)}
      aria-hidden="true"
      {...props}
    />
  )
);
DotSeparator.displayName = 'DotSeparator';

export { DotSeparator };

import * as React from 'react';
import { cn } from '../utils/cn';

export interface TruncateProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Max number of lines before truncating. Defaults to 1 (single line). */
  lines?: 1 | 2 | 3;
}

const lineClampClasses = {
  1: 'truncate',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
} as const;

const Truncate = React.forwardRef<HTMLSpanElement, TruncateProps>(
  ({ className, lines = 1, ...props }, ref) => (
    <span ref={ref} className={cn(lineClampClasses[lines], className)} {...props} />
  )
);
Truncate.displayName = 'Truncate';

export { Truncate };

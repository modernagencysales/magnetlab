import * as React from 'react';
import { cn } from '../utils/cn';
import { Skeleton } from './skeleton';

export interface LoadingRowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of skeleton rows to render */
  count?: number;
  /** Show avatar skeleton */
  showAvatar?: boolean;
}

function LoadingRow({ className, count = 3, showAvatar = false, ...props }: LoadingRowProps) {
  return (
    <div className={cn('space-y-3', className)} {...props}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2.5">
          {showAvatar && <Skeleton className="h-8 w-8 rounded-full" />}
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export { LoadingRow };

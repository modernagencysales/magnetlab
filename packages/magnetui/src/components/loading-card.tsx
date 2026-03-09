import * as React from 'react';
import { cn } from '../utils/cn';
import { Skeleton } from './skeleton';

export interface LoadingCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of skeleton cards to render */
  count?: number;
}

function LoadingCard({ className, count = 3, ...props }: LoadingCardProps) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)} {...props}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <div className="flex items-center gap-2 pt-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}

export { LoadingCard };

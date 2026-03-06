'use client';

import * as React from 'react';
import { cn } from '../utils/cn';

export interface RelativeTimeProps extends React.HTMLAttributes<HTMLTimeElement> {
  /** ISO date string or Date object */
  date: string | Date;
  /** Whether to include "ago" suffix */
  addSuffix?: boolean;
}

function getRelativeTime(date: Date, addSuffix: boolean): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  const suffix = addSuffix ? ' ago' : '';

  if (diffSec < 60) return `just now`;
  if (diffMin < 60) return `${diffMin}m${suffix}`;
  if (diffHour < 24) return `${diffHour}h${suffix}`;
  if (diffDay < 7) return `${diffDay}d${suffix}`;
  if (diffWeek < 5) return `${diffWeek}w${suffix}`;
  if (diffMonth < 12) return `${diffMonth}mo${suffix}`;
  return `${diffYear}y${suffix}`;
}

const RelativeTime = React.forwardRef<HTMLTimeElement, RelativeTimeProps>(
  ({ className, date, addSuffix = true, ...props }, ref) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const dateMs = dateObj.getTime();
    const [relative, setRelative] = React.useState(() => getRelativeTime(dateObj, addSuffix));

    React.useEffect(() => {
      const d = new Date(dateMs);
      setRelative(getRelativeTime(d, addSuffix));
      const interval = setInterval(() => {
        setRelative(getRelativeTime(d, addSuffix));
      }, 60_000); // Update every minute
      return () => clearInterval(interval);
    }, [dateMs, addSuffix]);

    return (
      <time
        ref={ref}
        dateTime={dateObj.toISOString()}
        title={dateObj.toLocaleString()}
        className={cn('text-xs text-muted-foreground tabular-nums', className)}
        {...props}
      >
        {relative}
      </time>
    );
  }
);
RelativeTime.displayName = 'RelativeTime';

export { RelativeTime };

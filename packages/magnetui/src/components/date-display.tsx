import * as React from 'react';
import { cn } from '../utils/cn';

export interface DateDisplayProps extends React.HTMLAttributes<HTMLTimeElement> {
  /** ISO date string or Date object */
  date: string | Date;
  /** Display format */
  format?: 'short' | 'medium' | 'long' | 'relative';
}

function formatDate(date: Date, format: DateDisplayProps['format']): string {
  switch (format) {
    case 'short':
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case 'long':
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    case 'medium':
    default:
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
  }
}

const DateDisplay = React.forwardRef<HTMLTimeElement, DateDisplayProps>(
  ({ className, date, format = 'medium', ...props }, ref) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    return (
      <time
        ref={ref}
        dateTime={dateObj.toISOString()}
        className={cn('text-sm text-muted-foreground', className)}
        {...props}
      >
        {formatDate(dateObj, format)}
      </time>
    );
  }
);
DateDisplay.displayName = 'DateDisplay';

export { DateDisplay };

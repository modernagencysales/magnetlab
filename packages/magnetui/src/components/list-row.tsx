'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '../utils/cn';

export interface ListRowProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
  /** Whether the row is currently selected */
  selected?: boolean;
  /** Left icon/avatar slot */
  leading?: React.ReactNode;
  /** Right action/badge slot */
  trailing?: React.ReactNode;
  /** Secondary text shown below the main content */
  description?: React.ReactNode;
}

const ListRow = React.forwardRef<HTMLDivElement, ListRowProps>(
  (
    { className, asChild = false, selected, leading, trailing, description, children, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : 'div';
    return (
      <Comp
        ref={ref}
        className={cn(
          'flex items-center gap-3 rounded-md px-2 py-2.5 text-sm transition-colors cursor-pointer',
          'hover:bg-accent/50',
          selected && 'bg-accent text-accent-foreground',
          className
        )}
        {...props}
      >
        {leading && <span className="flex shrink-0 items-center">{leading}</span>}
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{children}</span>
          {description && (
            <span className="truncate text-xs text-muted-foreground">{description}</span>
          )}
        </div>
        {trailing && <span className="flex shrink-0 items-center gap-1.5">{trailing}</span>}
      </Comp>
    );
  }
);
ListRow.displayName = 'ListRow';

export { ListRow };

'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../utils/cn';
import { iconStrokeWidth } from '../tokens/spacing';
import { Button } from './button';
import { Badge } from './badge';

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Active filter chips */
  filters?: Array<{ key: string; label: string; value: string }>;
  /** Callback to remove a filter */
  onRemoveFilter?: (key: string) => void;
  /** Callback to clear all filters */
  onClearAll?: () => void;
}

function FilterBar({
  className,
  filters = [],
  onRemoveFilter,
  onClearAll,
  children,
  ...props
}: FilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} {...props}>
      {children}
      {filters.length > 0 && (
        <>
          <div className="h-4 w-px bg-border" />
          {filters.map((filter) => (
            <Badge key={filter.key} variant="default" className="gap-1 pr-1">
              <span className="text-muted-foreground">{filter.label}:</span>
              {filter.value}
              {onRemoveFilter && (
                <button
                  type="button"
                  onClick={() => onRemoveFilter(filter.key)}
                  className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                >
                  <X size={12} strokeWidth={iconStrokeWidth} />
                </button>
              )}
            </Badge>
          ))}
          {onClearAll && (
            <Button variant="ghost" size="sm" onClick={onClearAll} className="h-6 text-xs">
              Clear all
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export { FilterBar };

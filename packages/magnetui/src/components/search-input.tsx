'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../utils/cn';
import { iconSize, iconStrokeWidth } from '../tokens/spacing';

export interface SearchInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type'
> {
  /** Callback when value changes (debounced externally if needed) */
  onValueChange?: (value: string) => void;
  /** Show clear button when value is present */
  clearable?: boolean;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onValueChange, clearable = true, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e);
      onValueChange?.(e.target.value);
    };

    const handleClear = () => {
      onValueChange?.('');
    };

    const showClear = clearable && value && String(value).length > 0;

    return (
      <div className={cn('relative', className)}>
        <Search
          size={iconSize.sm}
          strokeWidth={iconStrokeWidth}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={handleChange}
          className={cn(
            'flex h-8 w-full rounded-md border border-input bg-background py-1.5 pl-8 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            showClear ? 'pr-8' : 'pr-2.5'
          )}
          {...props}
        />
        {showClear && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X size={iconSize.sm} strokeWidth={iconStrokeWidth} />
          </button>
        )}
      </div>
    );
  }
);
SearchInput.displayName = 'SearchInput';

export { SearchInput };

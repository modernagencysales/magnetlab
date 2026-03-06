'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cn } from '../utils/cn';
import { iconStrokeWidth } from '../tokens/spacing';
import { Badge } from './badge';

export interface TagInputProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Current tags */
  value: string[];
  /** Callback when tags change */
  onChange: (tags: string[]) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Max number of tags */
  maxTags?: number;
  /** Whether the input is disabled */
  disabled?: boolean;
}

function TagInput({
  className,
  value,
  onChange,
  placeholder = 'Add tag...',
  maxTags,
  disabled,
  ...props
}: TagInputProps) {
  const [inputValue, setInputValue] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) return;
    if (maxTags && value.length >= maxTags) return;
    onChange([...value, trimmed]);
    setInputValue('');
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    }
    if (e.key === 'Backspace' && !inputValue && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  return (
    <div
      className={cn(
        'flex min-h-[32px] flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-within:ring-1 focus-within:ring-ring',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      onClick={() => inputRef.current?.focus()}
      {...props}
    >
      {value.map((tag) => (
        <Badge key={tag} variant="default" className="gap-1 pr-1">
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(tag);
              }}
              className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
            >
              <X size={12} strokeWidth={iconStrokeWidth} />
            </button>
          )}
        </Badge>
      ))}
      <input
        ref={inputRef}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => addTag(inputValue)}
        placeholder={value.length === 0 ? placeholder : ''}
        disabled={disabled || (maxTags !== undefined && value.length >= maxTags)}
        className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground min-w-[60px]"
      />
    </div>
  );
}

export { TagInput };

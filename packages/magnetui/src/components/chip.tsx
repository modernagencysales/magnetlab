'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';
import { iconStrokeWidth } from '../tokens/spacing';

const chipVariants = cva(
  'inline-flex items-center gap-1 rounded-full text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default:
          'bg-secondary text-foreground hover:bg-secondary/80',
        blue: 'bg-[rgba(107,159,212,0.12)] text-[#5A85AE] dark:bg-[rgba(107,159,212,0.15)] dark:text-[#8DB8E0]',
        green:
          'bg-[rgba(94,173,137,0.12)] text-[#4A8E6E] dark:bg-[rgba(94,173,137,0.15)] dark:text-[#7ECAA8]',
        orange:
          'bg-[rgba(210,155,70,0.12)] text-[#A07840] dark:bg-[rgba(210,155,70,0.15)] dark:text-[#D4B07A]',
        red: 'bg-[rgba(201,123,127,0.12)] text-[#9E5E62] dark:bg-[rgba(201,123,127,0.15)] dark:text-[#D4999C]',
        purple:
          'bg-[rgba(148,130,206,0.12)] text-[#7A6BA8] dark:bg-[rgba(148,130,206,0.15)] dark:text-[#B0A0DA]',
        outline: 'border border-border text-foreground bg-transparent',
      },
      size: {
        sm: 'h-5 px-1.5 text-2xs',
        default: 'h-6 px-2 text-xs',
        lg: 'h-7 px-2.5 text-xs',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ChipProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof chipVariants> {
  onRemove?: () => void;
}

const Chip = React.forwardRef<HTMLDivElement, ChipProps>(
  ({ className, variant, size, onRemove, children, ...props }, ref) => (
    <div ref={ref} className={cn(chipVariants({ variant, size }), className)} {...props}>
      <span className="truncate">{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
          aria-label="Remove"
        >
          <X className="h-3 w-3" strokeWidth={iconStrokeWidth} />
        </button>
      )}
    </div>
  )
);
Chip.displayName = 'Chip';

export { Chip, chipVariants };

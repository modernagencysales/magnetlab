'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0 text-2xs font-medium h-[22px] transition-colors',
  {
    variants: {
      variant: {
        default:
          'bg-[rgba(107,159,212,0.12)] text-[#5A85AE] dark:bg-[rgba(107,159,212,0.15)] dark:text-[#8DB8E0]',
        orange:
          'bg-[rgba(210,155,70,0.12)] text-[#A07840] dark:bg-[rgba(210,155,70,0.15)] dark:text-[#D4B07A]',
        blue: 'bg-[rgba(107,159,212,0.12)] text-[#5A85AE] dark:bg-[rgba(107,159,212,0.15)] dark:text-[#8DB8E0]',
        green:
          'bg-[rgba(94,173,137,0.12)] text-[#4A8E6E] dark:bg-[rgba(94,173,137,0.15)] dark:text-[#7ECAA8]',
        red: 'bg-[rgba(201,123,127,0.12)] text-[#9E5E62] dark:bg-[rgba(201,123,127,0.15)] dark:text-[#D4999C]',
        purple:
          'bg-[rgba(148,130,206,0.12)] text-[#7A6BA8] dark:bg-[rgba(148,130,206,0.15)] dark:text-[#B0A0DA]',
        gray: 'bg-[rgba(130,130,148,0.12)] text-[#7A7A8E] dark:text-[#9A9AAE]',
        count:
          'bg-secondary text-muted-foreground text-2xs min-w-[20px] h-5 justify-center rounded-full',
        outline: 'border border-border text-foreground bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };

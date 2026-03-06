'use client';

import * as React from 'react';
import { cn } from '../utils/cn';
import { Separator } from './separator';

const Toolbar = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="toolbar"
      className={cn(
        'flex items-center gap-1 rounded-lg border bg-background p-1 shadow-sm',
        className
      )}
      {...props}
    />
  )
);
Toolbar.displayName = 'Toolbar';

const ToolbarGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center gap-0.5', className)} {...props} />
  )
);
ToolbarGroup.displayName = 'ToolbarGroup';

const ToolbarSeparator = React.forwardRef<
  React.ComponentRef<typeof Separator>,
  React.ComponentPropsWithoutRef<typeof Separator>
>(({ className, ...props }, ref) => (
  <Separator ref={ref} orientation="vertical" className={cn('mx-1 h-5', className)} {...props} />
));
ToolbarSeparator.displayName = 'ToolbarSeparator';

export { Toolbar, ToolbarGroup, ToolbarSeparator };

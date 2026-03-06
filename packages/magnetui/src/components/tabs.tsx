'use client';

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../utils/cn';

const Tabs = TabsPrimitive.Root;

// ─── TabsList ────────────────────────────────────────────────────────────────
// variant="underline" (default): Bottom-border tabs for page sections
// variant="pill": Border-based pills for view switchers

export interface TabsListProps extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  variant?: 'underline' | 'pill';
}

const TabsList = React.forwardRef<React.ComponentRef<typeof TabsPrimitive.List>, TabsListProps>(
  ({ className, variant = 'underline', ...props }, ref) => (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        variant === 'underline'
          ? 'bg-transparent border-b border-border rounded-none h-auto p-0 gap-0 flex'
          : 'bg-transparent h-auto p-0 gap-0.5 flex',
        className
      )}
      {...props}
    />
  )
);
TabsList.displayName = TabsPrimitive.List.displayName;

// ─── TabsTrigger ─────────────────────────────────────────────────────────────

export interface TabsTriggerProps extends React.ComponentPropsWithoutRef<
  typeof TabsPrimitive.Trigger
> {
  variant?: 'underline' | 'pill';
}

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(({ className, variant = 'underline', ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
      variant === 'underline'
        ? 'rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:text-foreground text-muted-foreground px-4 py-2.5 text-sm font-medium bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none'
        : 'border border-transparent rounded-md px-2.5 py-1 text-sm data-[state=active]:bg-background data-[state=active]:border-border data-[state=active]:text-foreground text-muted-foreground data-[state=active]:shadow-none',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

// ─── TabsContent ─────────────────────────────────────────────────────────────

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };

'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../utils/cn';

const navItemVariants = cva(
  'group flex items-center gap-2 rounded-md px-2 text-sm font-medium transition-colors cursor-pointer select-none',
  {
    variants: {
      variant: {
        default: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        active: 'bg-accent text-accent-foreground',
        ghost: 'text-muted-foreground hover:text-foreground',
      },
      size: {
        default: 'h-8',
        sm: 'h-7 text-xs',
        lg: 'h-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface NavItemProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof navItemVariants> {
  asChild?: boolean;
  active?: boolean;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

const NavItem = React.forwardRef<HTMLButtonElement, NavItemProps>(
  ({ className, variant, size, asChild = false, active, icon, badge, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        className={cn(navItemVariants({ variant: active ? 'active' : variant, size, className }))}
        ref={ref}
        {...props}
      >
        {icon && (
          <span className="flex shrink-0 items-center [&>svg]:size-4 [&>svg]:shrink-0">{icon}</span>
        )}
        <span className="flex-1 truncate">{children}</span>
        {badge && <span className="ml-auto flex shrink-0 items-center">{badge}</span>}
      </Comp>
    );
  }
);
NavItem.displayName = 'NavItem';

export { NavItem, navItemVariants };

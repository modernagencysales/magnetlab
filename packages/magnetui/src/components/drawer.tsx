'use client';

import * as React from 'react';
import { cn } from '../utils/cn';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from './sheet';

// Drawer is a convenience wrapper around Sheet that defaults to bottom positioning
// and adds a drag handle indicator.

interface DrawerProps extends React.ComponentPropsWithoutRef<typeof Sheet> {
  children: React.ReactNode;
}

const Drawer = ({ children, ...props }: DrawerProps) => (
  <Sheet {...props}>{children}</Sheet>
);
Drawer.displayName = 'Drawer';

const DrawerTrigger = SheetTrigger;
DrawerTrigger.displayName = 'DrawerTrigger';

const DrawerClose = SheetClose;
DrawerClose.displayName = 'DrawerClose';

const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof SheetContent>,
  React.ComponentPropsWithoutRef<typeof SheetContent> & { showHandle?: boolean }
>(({ className, children, showHandle = true, side = 'bottom', ...props }, ref) => (
  <SheetContent
    ref={ref}
    side={side}
    className={cn(
      side === 'bottom' && 'rounded-t-xl',
      side === 'top' && 'rounded-b-xl',
      className
    )}
    {...props}
  >
    {showHandle && (side === 'bottom' || side === 'top') && (
      <div className="mx-auto mt-2 mb-4 h-1.5 w-12 rounded-full bg-muted-foreground/30 transition-colors" />
    )}
    {children}
  </SheetContent>
));
DrawerContent.displayName = 'DrawerContent';

const DrawerHeader = SheetHeader;
DrawerHeader.displayName = 'DrawerHeader';

const DrawerFooter = SheetFooter;
DrawerFooter.displayName = 'DrawerFooter';

const DrawerTitle = SheetTitle;
DrawerTitle.displayName = 'DrawerTitle';

const DrawerDescription = SheetDescription;
DrawerDescription.displayName = 'DrawerDescription';

export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};

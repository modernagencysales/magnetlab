import * as React from 'react';
import { cn } from '../utils/cn';

export interface TopBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Left-side content (breadcrumb, back button, title) */
  leading?: React.ReactNode;
  /** Right-side actions */
  trailing?: React.ReactNode;
}

const TopBar = React.forwardRef<HTMLDivElement, TopBarProps>(
  ({ className, leading, trailing, children, ...props }, ref) => (
    <header
      ref={ref}
      className={cn(
        'sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {leading}
        {children}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
    </header>
  )
);
TopBar.displayName = 'TopBar';

export { TopBar };

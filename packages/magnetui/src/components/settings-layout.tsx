import * as React from 'react';
import { cn } from '../utils/cn';

export interface SettingsLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Sidebar navigation */
  sidebar?: React.ReactNode;
  /** Width of the sidebar. Default: 200px */
  sidebarWidth?: number;
}

const SettingsLayout = React.forwardRef<HTMLDivElement, SettingsLayoutProps>(
  ({ className, sidebar, sidebarWidth = 200, children, ...props }, ref) => (
    <div ref={ref} className={cn('flex h-full', className)} {...props}>
      {sidebar && (
        <nav
          className="shrink-0 space-y-1 overflow-y-auto border-r py-4 pl-4 pr-2"
          style={{ width: sidebarWidth }}
        >
          {sidebar}
        </nav>
      )}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">{children}</div>
    </div>
  )
);
SettingsLayout.displayName = 'SettingsLayout';

export { SettingsLayout };

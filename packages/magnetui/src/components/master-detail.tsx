import * as React from 'react';
import { cn } from '../utils/cn';

export interface MasterDetailProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Width of the master pane */
  masterWidth?: string;
}

const MasterDetail = React.forwardRef<HTMLDivElement, MasterDetailProps>(
  ({ className, masterWidth: _masterWidth = '280px', children, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex h-full overflow-hidden', className)}
      style={{ ...style }}
      {...props}
    >
      {children}
    </div>
  )
);
MasterDetail.displayName = 'MasterDetail';

export interface MasterPaneProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Width of the pane. Defaults to 280px */
  width?: string | number;
}

const MasterPane = React.forwardRef<HTMLDivElement, MasterPaneProps>(
  ({ className, width = 280, style, children, ...props }, ref) => (
    <aside
      ref={ref}
      className={cn('flex shrink-0 flex-col overflow-y-auto border-r bg-background', className)}
      style={{ width: typeof width === 'number' ? `${width}px` : width, ...style }}
      {...props}
    >
      {children}
    </aside>
  )
);
MasterPane.displayName = 'MasterPane';

const DetailPane = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <main
      ref={ref}
      className={cn('flex min-w-0 flex-1 flex-col overflow-y-auto', className)}
      {...props}
    >
      {children}
    </main>
  )
);
DetailPane.displayName = 'DetailPane';

export { MasterDetail, MasterPane, DetailPane };

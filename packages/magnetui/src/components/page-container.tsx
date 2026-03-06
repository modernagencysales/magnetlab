import * as React from 'react';
import { cn } from '../utils/cn';

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Max width. "sm" = 640px, "md" = 768px, "lg" = 1024px, "xl" = 1280px, "full" = 100% */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const maxWidthClasses = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  full: 'max-w-full',
} as const;

const PageContainer = React.forwardRef<HTMLDivElement, PageContainerProps>(
  ({ className, maxWidth = 'xl', children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('mx-auto w-full px-6 py-6', maxWidthClasses[maxWidth], className)}
      {...props}
    >
      {children}
    </div>
  )
);
PageContainer.displayName = 'PageContainer';

export { PageContainer };

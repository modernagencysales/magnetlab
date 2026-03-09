import * as React from 'react';
import { cn } from '../utils/cn';

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Maximum number of avatars to show before +N */
  max?: number;
}

const AvatarGroup = React.forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ className, max = 4, children, ...props }, ref) => {
    const childArray = React.Children.toArray(children);
    const visible = childArray.slice(0, max);
    const overflow = childArray.length - max;

    return (
      <div ref={ref} className={cn('flex items-center -space-x-2', className)} {...props}>
        {visible.map((child, i) => (
          <div key={i} className="ring-2 ring-background rounded-full">
            {child}
          </div>
        ))}
        {overflow > 0 && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-muted text-xs font-medium text-muted-foreground">
            +{overflow}
          </div>
        )}
      </div>
    );
  }
);
AvatarGroup.displayName = 'AvatarGroup';

export { AvatarGroup };

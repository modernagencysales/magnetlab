'use client';

import * as React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { cn } from '../utils/cn';
import { iconSize, iconStrokeWidth } from '../tokens/spacing';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';

export interface ActionMenuAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
  /** Insert separator before this item */
  separator?: boolean;
}

export interface ActionMenuProps {
  actions: ActionMenuAction[];
  /** Custom trigger button. Defaults to a MoreHorizontal icon button */
  trigger?: React.ReactNode;
  /** Alignment of the dropdown */
  align?: 'start' | 'center' | 'end';
  className?: string;
}

function ActionMenu({ actions, trigger, align = 'end', className }: ActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon-sm" className={cn('h-7 w-7', className)}>
            <MoreHorizontal size={iconSize.md} strokeWidth={iconStrokeWidth} />
            <span className="sr-only">Open menu</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {actions.map((action, i) => (
          <React.Fragment key={i}>
            {action.separator && i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={action.onClick}
              disabled={action.disabled}
              className={cn(
                action.variant === 'destructive' &&
                  'text-red-600 focus:text-red-600 dark:text-red-400'
              )}
            >
              {action.icon && (
                <span className="[&>svg]:size-4 [&>svg]:shrink-0">{action.icon}</span>
              )}
              {action.label}
            </DropdownMenuItem>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { ActionMenu };

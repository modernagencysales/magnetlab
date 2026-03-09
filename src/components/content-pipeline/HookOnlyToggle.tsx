'use client';

import { cn } from '@/lib/utils';

interface HookOnlyToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

export function HookOnlyToggle({ enabled, onChange }: HookOnlyToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={cn(
        'rounded-lg px-3 py-1 text-xs font-medium transition-colors border',
        enabled
          ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-300'
          : 'border-border text-muted-foreground hover:bg-muted'
      )}
    >
      Hook Only
    </button>
  );
}

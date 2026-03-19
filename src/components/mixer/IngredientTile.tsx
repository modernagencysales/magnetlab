'use client';

/**
 * IngredientTile. Selectable chip for a single ingredient type in the mixer.
 * Three states: unselected (dashed), selected (solid colored), loading (pulse).
 * Never imports from Next.js HTTP layer.
 */

import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';
import type { IngredientType } from '@/lib/types/mixer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface IngredientTileProps {
  type: IngredientType;
  label: string;
  icon: LucideIcon | string;
  selected: boolean;
  selectedName: string | null;
  color: string;
  onSelect: () => void;
  onDeselect: () => void;
  loading?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function IngredientTile({
  label,
  icon,
  selected,
  selectedName,
  color,
  onSelect,
  onDeselect,
  loading = false,
}: IngredientTileProps) {
  const IconComponent = typeof icon !== 'string' ? icon : null;
  const emojiIcon = typeof icon === 'string' ? icon : null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border bg-muted/30 animate-pulse min-w-[100px]">
        <div className="h-4 w-4 rounded bg-muted" />
        <div className="h-3 w-16 rounded bg-muted" />
      </div>
    );
  }

  if (selected && selectedName) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all',
          'border-2',
          color
        )}
        onClick={onSelect}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onSelect()}
        aria-label={`${label}: ${selectedName}. Click to change.`}
      >
        {IconComponent && <IconComponent className="h-4 w-4 flex-shrink-0" />}
        {emojiIcon && <span className="text-sm flex-shrink-0">{emojiIcon}</span>}
        <div className="flex flex-col min-w-0">
          <span className="text-[10px] font-medium uppercase tracking-wide opacity-70 leading-none">
            {label}
          </span>
          <span className="text-xs font-semibold truncate max-w-[120px]">{selectedName}</span>
        </div>
        <button
          type="button"
          className="ml-1 flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDeselect();
          }}
          aria-label={`Remove ${label}`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border',
        'cursor-pointer opacity-60 hover:opacity-90 transition-all bg-muted/20 hover:bg-muted/40',
        'min-w-[100px]'
      )}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      aria-label={`Add ${label} ingredient`}
    >
      {IconComponent && <IconComponent className="h-4 w-4 flex-shrink-0 text-muted-foreground" />}
      {emojiIcon && <span className="text-sm flex-shrink-0">{emojiIcon}</span>}
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

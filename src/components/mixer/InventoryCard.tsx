'use client';

/**
 * InventoryCard. Count card for a single ingredient type in the inventory zone.
 * Shows icon, count, health status, and sub-label. Clickable.
 * Never imports from Next.js HTTP layer.
 */

import { cn } from '@/lib/utils';
import { INGREDIENT_META } from './ingredientMeta';
import type { IngredientType, HealthStatus } from '@/lib/types/mixer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InventoryCardProps {
  type: IngredientType;
  count: number;
  health: HealthStatus;
  healthDetail: string | null;
  subLabel: string | null;
  onClick: () => void;
}

// ─── Health styles ────────────────────────────────────────────────────────────

const HEALTH_STYLES: Record<
  NonNullable<HealthStatus>,
  { dot: string; text: string; label: string }
> = {
  healthy: { dot: 'bg-emerald-500', text: 'text-emerald-500', label: 'Healthy' },
  active: { dot: 'bg-blue-500', text: 'text-blue-500', label: 'Active' },
  new: { dot: 'bg-yellow-500', text: 'text-yellow-500', label: 'New' },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function InventoryCard({
  type,
  count,
  health,
  healthDetail,
  subLabel,
  onClick,
}: InventoryCardProps) {
  const meta = INGREDIENT_META[type];
  const Icon = meta.lucideIcon;
  const healthStyle = health ? HEALTH_STYLES[health] : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col gap-2 p-4 rounded-lg border border-border bg-card',
        'hover:bg-accent/50 hover:border-border/80 transition-all text-left w-full'
      )}
    >
      {/* ─── Icon row ─────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="h-8 w-8 rounded-md bg-muted/50 flex items-center justify-center">
          <Icon className={`h-4 w-4 ${meta.accentClass}`} />
        </div>
        {healthStyle && (
          <div className="flex items-center gap-1" title={healthDetail ?? healthStyle.label}>
            <div className={cn('h-1.5 w-1.5 rounded-full', healthStyle.dot)} />
            <span className={cn('text-[10px] font-medium', healthStyle.text)}>
              {healthStyle.label}
            </span>
          </div>
        )}
      </div>

      {/* ─── Count ────────────────────────────────────────── */}
      <div className="text-2xl font-bold text-foreground tabular-nums">{count}</div>

      {/* ─── Labels ───────────────────────────────────────── */}
      <div>
        <div className="text-sm font-medium text-foreground">{meta.label}s</div>
        {subLabel && <div className="text-xs text-muted-foreground mt-0.5">{subLabel}</div>}
      </div>
    </button>
  );
}

'use client';

/**
 * InventoryZone. Zone 3 — ingredient inventory grid.
 * Shows count cards per ingredient type + an add card at the end.
 * Never imports from Next.js HTTP layer.
 */

import { Plus } from 'lucide-react';
import { useInventory } from '@/frontend/hooks/api/useMixer';
import { InventoryCard } from './InventoryCard';
import { INGREDIENT_META, INGREDIENT_TYPE_ORDER } from './ingredientMeta';
import type { IngredientType } from '@/lib/types/mixer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InventoryZoneProps {
  teamProfileId: string;
  onManageType: (type: IngredientType) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InventoryZone({ teamProfileId, onManageType }: InventoryZoneProps) {
  const { data: inventory, isLoading } = useInventory(teamProfileId);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-24 bg-muted/50 rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-[110px] rounded-lg bg-muted/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Build a lookup from type → count data
  const countMap = new Map((inventory?.ingredients ?? []).map((ing) => [ing.type, ing]));

  return (
    <div className="space-y-2">
      {/* ─── Section header ────────────────────────────── */}
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Ingredient Inventory
      </h3>

      {/* ─── 4-column grid ─────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {INGREDIENT_TYPE_ORDER.map((type) => {
          const data = countMap.get(type);
          return (
            <InventoryCard
              key={type}
              type={type}
              count={data?.count ?? 0}
              health={data?.health ?? null}
              healthDetail={data?.health_detail ?? null}
              subLabel={data?.sub_label ?? null}
              onClick={() => onManageType(type)}
            />
          );
        })}

        {/* Add card */}
        <button
          type="button"
          onClick={() => onManageType('exploits')}
          className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-dashed border-border bg-muted/10 hover:bg-muted/30 transition-all text-center"
          title="Add ingredients"
        >
          <div className="h-8 w-8 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
            <Plus className="h-4 w-4 text-muted-foreground/50" />
          </div>
          <span className="text-xs text-muted-foreground/60">Add more</span>
        </button>
      </div>

      {/* ─── Type labels legend ────────────────────────── */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
        {INGREDIENT_TYPE_ORDER.map((type) => {
          const meta = INGREDIENT_META[type];
          const Icon = meta.lucideIcon;
          return (
            <div key={type} className="flex items-center gap-1">
              <Icon className={`h-3 w-3 ${meta.accentClass}`} />
              <span className="text-[10px] text-muted-foreground">{meta.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

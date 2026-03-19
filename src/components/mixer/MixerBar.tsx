'use client';

/**
 * MixerBar. Collapsed recipe summary bar shown after generation.
 * Shows selected ingredient chips plus Edit and Regenerate actions.
 * Never imports from Next.js HTTP layer.
 */

import { RotateCcw, Pencil } from 'lucide-react';
import { INGREDIENT_META } from './ingredientMeta';
import type { IngredientType } from '@/lib/types/mixer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SelectedIngredient {
  type: IngredientType;
  name: string;
  color: string;
}

interface MixerBarProps {
  ingredients: SelectedIngredient[];
  onEditRecipe: () => void;
  onRegenerate: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MixerBar({ ingredients, onEditRecipe, onRegenerate }: MixerBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap py-3 px-4 rounded-lg border border-border bg-card">
      {/* ─── Ingredient chips ─────────────────────────────── */}
      <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
        {ingredients.map(({ type, name }) => {
          const meta = INGREDIENT_META[type];
          const Icon = meta.lucideIcon;
          return (
            <div
              key={type}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 border border-border"
            >
              <Icon className={`h-3 w-3 ${meta.accentClass} flex-shrink-0`} />
              <span className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{name}</span>
              </span>
            </div>
          );
        })}
        {ingredients.length === 0 && (
          <span className="text-xs text-muted-foreground">No ingredients selected</span>
        )}
      </div>

      {/* ─── Actions ──────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          type="button"
          onClick={onEditRecipe}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Pencil className="h-3 w-3" />
          Edit recipe
        </button>
        <button
          type="button"
          onClick={onRegenerate}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Regenerate
        </button>
      </div>
    </div>
  );
}

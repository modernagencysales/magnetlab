'use client';

/**
 * RecipeCard. Small card showing a recipe suggestion with ingredient icons and multiplier.
 * Read-only — used in the recipes zone horizontal scroll.
 * Never imports from Next.js HTTP layer.
 */

import { INGREDIENT_META } from './ingredientMeta';
import type { RecipeSuggestion } from '@/lib/types/mixer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecipeCardProps {
  recipe: RecipeSuggestion;
  onClick: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RecipeCard({ recipe, onClick }: RecipeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-2 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 hover:border-border/80 transition-all text-left min-w-[180px] max-w-[200px] flex-shrink-0"
    >
      {/* ─── Ingredient icons ─────────────────────────────── */}
      <div className="flex gap-1.5 flex-wrap">
        {recipe.ingredients.map((ing, i) => {
          const meta = INGREDIENT_META[ing.type];
          const Icon = meta.lucideIcon;
          return (
            <div
              key={i}
              className="h-6 w-6 rounded-md bg-muted/50 flex items-center justify-center"
              title={ing.name}
            >
              <Icon className={`h-3.5 w-3.5 ${meta.accentClass}`} />
            </div>
          );
        })}
      </div>

      {/* ─── Name + multiplier ───────────────────────────── */}
      <div className="flex items-start justify-between gap-1">
        <span className="text-sm font-medium text-foreground leading-snug line-clamp-2">
          {recipe.combo_name}
        </span>
        {recipe.multiplier > 1 && (
          <span className="flex-shrink-0 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
            {recipe.multiplier.toFixed(1)}x
          </span>
        )}
      </div>

      {/* ─── Context ──────────────────────────────────────── */}
      <p className="text-xs text-muted-foreground line-clamp-2">{recipe.context}</p>

      {/* ─── Post count ───────────────────────────────────── */}
      {recipe.post_count > 0 && (
        <span className="text-[10px] text-muted-foreground">
          {recipe.post_count} post{recipe.post_count !== 1 ? 's' : ''} generated
        </span>
      )}
    </button>
  );
}

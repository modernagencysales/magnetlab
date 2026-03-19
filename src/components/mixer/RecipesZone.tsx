'use client';

/**
 * RecipesZone. Zone 2 — horizontally scrolling recipe suggestions.
 * Hidden when no recipes available. Includes a "Surprise me" card.
 * Never imports from Next.js HTTP layer.
 */

import { Shuffle } from 'lucide-react';
import { useRecipes } from '@/frontend/hooks/api/useMixer';
import { RecipeCard } from './RecipeCard';
import type { RecipeSuggestion } from '@/lib/types/mixer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecipesZoneProps {
  teamProfileId: string;
  onSelectRecipe: (recipe: RecipeSuggestion) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RecipesZone({ teamProfileId, onSelectRecipe }: RecipesZoneProps) {
  const { data: recipes, isLoading } = useRecipes(teamProfileId);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-32 bg-muted/50 rounded animate-pulse" />
        <div className="flex gap-3 overflow-x-auto pb-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[140px] min-w-[180px] rounded-lg bg-muted/40 animate-pulse flex-shrink-0"
            />
          ))}
        </div>
      </div>
    );
  }

  // Hidden when no recipes
  if (!recipes || recipes.length === 0) return null;

  const handleSurpriseMe = () => {
    const random = recipes[Math.floor(Math.random() * recipes.length)];
    if (random) onSelectRecipe(random);
  };

  return (
    <div className="space-y-2">
      {/* ─── Section header ────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Recipe Suggestions
        </h3>
        <span className="text-xs text-muted-foreground">{recipes.length} combos</span>
      </div>

      {/* ─── Horizontal scroll ─────────────────────────── */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
        {recipes.map((recipe, i) => (
          <RecipeCard key={i} recipe={recipe} onClick={() => onSelectRecipe(recipe)} />
        ))}

        {/* Surprise me card */}
        <button
          type="button"
          onClick={handleSurpriseMe}
          className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border border-dashed border-border bg-muted/20 hover:bg-muted/40 transition-all text-center min-w-[120px] flex-shrink-0"
        >
          <Shuffle className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Surprise me</span>
        </button>
      </div>
    </div>
  );
}

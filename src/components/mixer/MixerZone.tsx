'use client';

/**
 * MixerZone. Zone 1 — the main mixer interface.
 * Orchestrates ingredient tile selection, drawer, instructions, and generation.
 * Collapses to MixerBar after generation and hands off to ResultsZone.
 * Never imports from Next.js HTTP layer.
 */

import { useState, useCallback } from 'react';
import { Button } from '@magnetlab/magnetui';
import { Zap, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMix } from '@/frontend/hooks/api/useMixer';
import { createPost } from '@/frontend/api/content-pipeline/posts';
import { IngredientTile } from './IngredientTile';
import { IngredientDrawer } from './IngredientDrawer';
import { MixerBar } from './MixerBar';
import { ResultsZone } from './ResultsZone';
import { INGREDIENT_META, INGREDIENT_TYPE_ORDER } from './ingredientMeta';
import type { IngredientType, MixerResult } from '@/lib/types/mixer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MixerZoneProps {
  teamProfileId: string;
  authorName?: string;
  authorInitials?: string;
}

interface SelectedIngredient {
  id: string;
  name: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMixInput(
  teamProfileId: string,
  selected: Map<IngredientType, SelectedIngredient>,
  instructions: string,
  output: 'drafts' | 'ideas'
) {
  return {
    team_profile_id: teamProfileId,
    exploit_id: selected.get('exploits')?.id,
    style_id: selected.get('styles')?.id,
    template_id: selected.get('templates')?.id,
    creative_id: selected.get('creatives')?.id,
    knowledge_topic: selected.get('knowledge')?.name,
    trend_topic: selected.get('trends')?.name,
    recycled_post_id: selected.get('recycled')?.id,
    instructions: instructions.trim() || undefined,
    output,
    count: 3,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MixerZone({
  teamProfileId,
  authorName = 'You',
  authorInitials = 'Y',
}: MixerZoneProps) {
  // ─── State ──────────────────────────────────────────
  const [selected, setSelected] = useState<Map<IngredientType, SelectedIngredient>>(new Map());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeDrawerType, setActiveDrawerType] = useState<IngredientType>('exploits');
  const [instructions, setInstructions] = useState('');
  const [result, setResult] = useState<MixerResult | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const { generate, isPending } = useMix();

  // ─── Handlers ───────────────────────────────────────
  const handleTileClick = useCallback((type: IngredientType) => {
    setActiveDrawerType(type);
    setDrawerOpen(true);
  }, []);

  const handleSelect = useCallback(
    (item: { id: string; name: string }) => {
      setSelected((prev) => {
        const next = new Map(prev);
        next.set(activeDrawerType, item);
        return next;
      });
    },
    [activeDrawerType]
  );

  const handleDeselect = useCallback((type: IngredientType) => {
    setSelected((prev) => {
      const next = new Map(prev);
      next.delete(type);
      return next;
    });
  }, []);

  const handleGenerate = useCallback(
    async (output: 'drafts' | 'ideas' = 'drafts') => {
      if (selected.size === 0) {
        toast.error('Pick at least one ingredient to mix');
        return;
      }
      try {
        const input = buildMixInput(teamProfileId, selected, instructions, output);
        const res = await generate(input);
        setResult(res);
        setCollapsed(true);
      } catch {
        toast.error('Failed to generate — please try again');
      }
    },
    [selected, instructions, teamProfileId, generate]
  );

  const handleEditRecipe = useCallback(() => {
    setCollapsed(false);
    setResult(null);
  }, []);

  const handleRegenerate = useCallback(async () => {
    if (selected.size === 0) return;
    try {
      const output = result?.type ?? 'drafts';
      const input = buildMixInput(teamProfileId, selected, instructions, output);
      const res = await generate(input);
      setResult(res);
    } catch {
      toast.error('Regeneration failed — please try again');
    }
  }, [selected, instructions, teamProfileId, generate, result]);

  const handleSendToQueue = useCallback(async (postContent: string) => {
    try {
      await createPost({ body: postContent });
      toast.success('Post sent to content queue');
    } catch {
      toast.error('Failed to send to queue — please try again');
    }
  }, []);

  // ─── Selected ingredients for MixerBar ──────────────
  const selectedIngredients = INGREDIENT_TYPE_ORDER.filter((t) => selected.has(t)).map((t) => ({
    type: t,
    name: selected.get(t)!.name,
    color: INGREDIENT_META[t].selectedClasses,
  }));

  // ─── Render ──────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ─── Collapsed recipe bar ─────────────────────── */}
      {collapsed && result ? (
        <MixerBar
          ingredients={selectedIngredients}
          onEditRecipe={handleEditRecipe}
          onRegenerate={handleRegenerate}
        />
      ) : (
        <>
          {/* ─── Ingredient tiles ─────────────────────── */}
          <div className="flex flex-wrap gap-2">
            {INGREDIENT_TYPE_ORDER.map((type) => {
              const meta = INGREDIENT_META[type];
              const sel = selected.get(type);
              return (
                <IngredientTile
                  key={type}
                  type={type}
                  label={meta.label}
                  icon={meta.lucideIcon}
                  selected={!!sel}
                  selectedName={sel?.name ?? null}
                  color={meta.selectedClasses}
                  onSelect={() => handleTileClick(type)}
                  onDeselect={() => handleDeselect(type)}
                />
              );
            })}
          </div>

          {/* ─── Instructions ─────────────────────────── */}
          <div>
            <textarea
              className="w-full min-h-[72px] px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Any extra direction for the AI? (optional)"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={3}
            />
          </div>

          {/* ─── Generate actions ─────────────────────── */}
          <div className="flex items-center gap-3">
            <Button
              className="flex-1"
              onClick={() => handleGenerate('drafts')}
              disabled={isPending || selected.size === 0}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-1.5" />
                  Generate Drafts
                </>
              )}
            </Button>
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              onClick={() => handleGenerate('ideas')}
              disabled={isPending || selected.size === 0}
            >
              Generate Ideas instead
            </button>
          </div>
        </>
      )}

      {/* ─── Results zone ─────────────────────────────── */}
      {result && (
        <ResultsZone
          result={result}
          ingredients={selectedIngredients}
          onEditRecipe={handleEditRecipe}
          onRegenerate={handleRegenerate}
          onSendToQueue={handleSendToQueue}
          onSendAll={() => toast.success('All drafts sent to queue')}
          authorName={authorName}
          authorInitials={authorInitials}
        />
      )}

      {/* ─── Ingredient drawer ─────────────────────────── */}
      <IngredientDrawer
        type={activeDrawerType}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        teamProfileId={teamProfileId}
        onSelect={handleSelect}
      />
    </div>
  );
}

'use client';

/**
 * PostsContent. Client entry point for the Posts page.
 * Renders the ingredient mixer zones: Mixer, Recipes, StartFromHere, Saved Ideas.
 * The profile switcher drives teamProfileId for all zone data fetches.
 * Lifts MixerZone's selected/drawer state so StartFromHere can pre-fill the mixer.
 * Never imports from Next.js HTTP layer.
 */

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Sparkles } from 'lucide-react';
import { PageContainer, PageTitle } from '@magnetlab/magnetui';

import {
  ProfileSwitcher,
  useProfileSelection,
} from '@/components/content-pipeline/ProfileSwitcher';

import type { IngredientType } from '@/lib/types/mixer';
import type { SelectedIngredient } from '@/components/mixer/MixerZone';

// ─── Dynamic imports ───────────────────────────────────────────────────────────

const MixerZone = dynamic(
  () => import('@/components/mixer/MixerZone').then((m) => ({ default: m.MixerZone })),
  { ssr: false, loading: () => <div className="h-40 animate-pulse bg-muted/20 rounded-lg" /> }
);
const RecipesZone = dynamic(
  () => import('@/components/mixer/RecipesZone').then((m) => ({ default: m.RecipesZone })),
  { ssr: false }
);
const StartFromHere = dynamic(
  () => import('@/components/mixer/StartFromHere').then((m) => ({ default: m.StartFromHere })),
  { ssr: false }
);
const SavedIdeasSection = dynamic(
  () =>
    import('@/components/mixer/SavedIdeasSection').then((m) => ({ default: m.SavedIdeasSection })),
  { ssr: false }
);

const QuickWriteModal = dynamic(
  () =>
    import('@/components/content-pipeline/QuickWriteModal').then((m) => ({
      default: m.QuickWriteModal,
    })),
  { ssr: false }
);

// ─── Component ────────────────────────────────────────────────────────────────

export function PostsContent() {
  const { selectedProfileId, onProfileChange } = useProfileSelection();
  const [showQuickWrite, setShowQuickWrite] = useState(false);

  // ─── Lifted mixer state ──────────────────────────────────────────────────
  // Lifted from MixerZone so StartFromHere can pre-fill ingredient selection.

  const [selected, setSelected] = useState<Map<IngredientType, SelectedIngredient>>(new Map());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeDrawerType, setActiveDrawerType] = useState<IngredientType>('exploits');

  const handleSelect = useCallback((type: IngredientType, item: SelectedIngredient) => {
    setSelected((prev) => {
      const next = new Map(prev);
      next.set(type, item);
      return next;
    });
  }, []);

  const handleDeselect = useCallback((type: IngredientType) => {
    setSelected((prev) => {
      const next = new Map(prev);
      next.delete(type);
      return next;
    });
  }, []);

  // ─── StartFromHere handler ───────────────────────────────────────────────
  // Called when user clicks a feed card — pre-fills that ingredient in the mixer.

  const handleSelectIngredient = useCallback(
    (type: IngredientType, item: { id: string; name: string }) => {
      handleSelect(type, item);
      // Scroll to the top of the page so the mixer tiles are visible
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [handleSelect]
  );

  // teamProfileId drives all mixer zone queries — null means no profile selected yet
  const teamProfileId = selectedProfileId;

  return (
    <PageContainer maxWidth="xl">
      {/* ─── Page header ───────────────────────────────────────────── */}
      <PageTitle
        title="Posts"
        description="Mix ingredients to generate on-brand LinkedIn content"
        actions={
          <ProfileSwitcher
            selectedProfileId={selectedProfileId}
            onProfileChange={onProfileChange}
          />
        }
      />

      <div className="mt-6 space-y-8">
        {/* ─── Zone 1: The Mixer ─────────────────────────────────── */}
        {teamProfileId && (
          <MixerZone
            teamProfileId={teamProfileId}
            selected={selected}
            onSelect={handleSelect}
            onDeselect={handleDeselect}
            drawerOpen={drawerOpen}
            activeDrawerType={activeDrawerType}
            onDrawerOpenChange={setDrawerOpen}
            onDrawerTypeChange={setActiveDrawerType}
          />
        )}
        {!teamProfileId && (
          <div className="rounded-lg border border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
            Select a profile above to start mixing
          </div>
        )}

        {/* ─── Zone 2: Recipe Suggestions ────────────────────────── */}
        {teamProfileId && (
          <RecipesZone
            teamProfileId={teamProfileId}
            onSelectRecipe={() => {
              // v1: recipes and mixer work independently — clicking a recipe
              // surfaces it visually via the card but does not auto-fill the mixer.
              // Auto-fill is a planned enhancement.
            }}
          />
        )}

        {/* ─── Zone 3: Start From Here ────────────────────────────── */}
        {teamProfileId && (
          <StartFromHere
            teamProfileId={teamProfileId}
            onSelectIngredient={handleSelectIngredient}
          />
        )}

        {/* ─── Zone 4: Saved Ideas ────────────────────────────────── */}
        {teamProfileId && <SavedIdeasSection teamProfileId={teamProfileId} />}
      </div>

      {/* ─── Quick Write FAB ──────────────────────────────────────── */}
      <button
        onClick={() => setShowQuickWrite(true)}
        className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
        title="Quick Write"
      >
        <Sparkles className="h-5 w-5" />
      </button>
      {showQuickWrite && (
        <QuickWriteModal
          onClose={() => setShowQuickWrite(false)}
          onPostCreated={() => setShowQuickWrite(false)}
          profileId={selectedProfileId}
        />
      )}
    </PageContainer>
  );
}

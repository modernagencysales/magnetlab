'use client';

/**
 * PostsContent. Client entry point for the Posts page.
 * Renders the four ingredient mixer zones: Mixer, Recipes, Inventory, Saved Ideas.
 * The profile switcher drives teamProfileId for all zone data fetches.
 * Never imports from Next.js HTTP layer.
 */

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Sparkles } from 'lucide-react';
import { PageContainer, PageTitle } from '@magnetlab/magnetui';

import {
  ProfileSwitcher,
  useProfileSelection,
} from '@/components/content-pipeline/ProfileSwitcher';

const MixerZone = dynamic(
  () => import('@/components/mixer/MixerZone').then((m) => ({ default: m.MixerZone })),
  { ssr: false, loading: () => <div className="h-40 animate-pulse bg-muted/20 rounded-lg" /> }
);
const RecipesZone = dynamic(
  () => import('@/components/mixer/RecipesZone').then((m) => ({ default: m.RecipesZone })),
  { ssr: false }
);
const InventoryZone = dynamic(
  () => import('@/components/mixer/InventoryZone').then((m) => ({ default: m.InventoryZone })),
  { ssr: false }
);
const SavedIdeasSection = dynamic(
  () => import('@/components/mixer/SavedIdeasSection').then((m) => ({ default: m.SavedIdeasSection })),
  { ssr: false }
);
import type { IngredientType } from '@/lib/types/mixer';

// ─── Dynamic imports ───────────────────────────────────────────────────────────

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

  // teamProfileId drives all mixer zone queries — null means no profile selected yet
  const teamProfileId = selectedProfileId;

  // InventoryZone: clicking a type card could open the relevant settings page in future;
  // for v1 it's a no-op — the tiles are still useful as count indicators.
  function handleManageType(_type: IngredientType) {
    // TODO: navigate to the ingredient management view for this type
  }

  return (
    <PageContainer maxWidth="xl">
      {/* ─── Page header ──────────────────────────────────────────── */}
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
        {/* ─── Zone 1: The Mixer ──────────────────────────────────── */}
        {teamProfileId && <MixerZone teamProfileId={teamProfileId} />}
        {!teamProfileId && (
          <div className="rounded-lg border border-border bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
            Select a profile above to start mixing
          </div>
        )}

        {/* ─── Zone 2: Recipe Suggestions ─────────────────────────── */}
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

        {/* ─── Zone 3: Ingredient Inventory ───────────────────────── */}
        {teamProfileId && (
          <InventoryZone teamProfileId={teamProfileId} onManageType={handleManageType} />
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

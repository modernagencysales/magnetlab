/** Mixer API module. Client-side functions for the ingredient mixer. */

import { apiClient } from '../client';
import type {
  MixerResult,
  IngredientInventory,
  RecipeSuggestion,
  ComboPerformance,
} from '@/lib/types/mixer';
import type { MixInput } from '@/lib/validations/mixer';

// ─── Writes ───────────────────────────────────────────────────────────────────

export async function mix(input: MixInput): Promise<MixerResult> {
  return apiClient.post<MixerResult>('/content-pipeline/mix', input);
}

// ─── Reads ────────────────────────────────────────────────────────────────────

export async function getInventory(teamProfileId: string): Promise<IngredientInventory> {
  const res = await apiClient.get<{ inventory: IngredientInventory }>(
    `/content-pipeline/inventory?team_profile_id=${encodeURIComponent(teamProfileId)}`
  );
  return res.inventory;
}

export async function getRecipes(teamProfileId: string, limit = 5): Promise<RecipeSuggestion[]> {
  const res = await apiClient.get<{ recipes: RecipeSuggestion[] }>(
    `/content-pipeline/recipes?team_profile_id=${encodeURIComponent(teamProfileId)}&limit=${limit}`
  );
  return res.recipes;
}

export async function getComboPerformance(
  teamProfileId: string,
  limit = 10
): Promise<ComboPerformance[]> {
  const res = await apiClient.get<{ combos: ComboPerformance[] }>(
    `/content-pipeline/combo-performance?team_profile_id=${encodeURIComponent(teamProfileId)}&limit=${limit}`
  );
  return res.combos;
}

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
  return apiClient.get<IngredientInventory>(
    `/content-pipeline/inventory?team_profile_id=${encodeURIComponent(teamProfileId)}`
  );
}

export async function getRecipes(teamProfileId: string, limit = 5): Promise<RecipeSuggestion[]> {
  return apiClient.get<RecipeSuggestion[]>(
    `/content-pipeline/recipes?team_profile_id=${encodeURIComponent(teamProfileId)}&limit=${limit}`
  );
}

export async function getComboPerformance(
  teamProfileId: string,
  limit = 10
): Promise<ComboPerformance[]> {
  return apiClient.get<ComboPerformance[]>(
    `/content-pipeline/combo-performance?team_profile_id=${encodeURIComponent(teamProfileId)}&limit=${limit}`
  );
}

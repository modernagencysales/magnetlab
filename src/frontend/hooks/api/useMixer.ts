'use client';

/** Mixer hooks. SWR for queries, useCallback for mutations. */

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import {
  mix,
  getInventory,
  getRecipes,
  getComboPerformance,
} from '@/frontend/api/content-pipeline/mixer';
import type {
  MixerResult,
  IngredientInventory,
  RecipeSuggestion,
  ComboPerformance,
} from '@/lib/types/mixer';
import type { MixInput } from '@/lib/validations/mixer';

// ─── Query hooks ──────────────────────────────────────────────────────────────

export function useInventory(teamProfileId: string | null) {
  const swrKey = teamProfileId ? ['inventory', teamProfileId] : null;

  const { data, error, isLoading, mutate } = useSWR<IngredientInventory>(
    swrKey,
    () => getInventory(teamProfileId!),
    { revalidateOnFocus: false }
  );

  return { data, error, isLoading, mutate };
}

export function useRecipes(teamProfileId: string | null) {
  const swrKey = teamProfileId ? ['recipes', teamProfileId] : null;

  const { data, error, isLoading, mutate } = useSWR<RecipeSuggestion[]>(
    swrKey,
    () => getRecipes(teamProfileId!),
    { revalidateOnFocus: false }
  );

  return { data, error, isLoading, mutate };
}

export function useComboPerformance(teamProfileId: string | null) {
  const swrKey = teamProfileId ? ['combo-performance', teamProfileId] : null;

  const { data, error, isLoading, mutate } = useSWR<ComboPerformance[]>(
    swrKey,
    () => getComboPerformance(teamProfileId!),
    { revalidateOnFocus: false }
  );

  return { data, error, isLoading, mutate };
}

// ─── Mutation hook ────────────────────────────────────────────────────────────

export function useMix() {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<MixerResult | null>(null);

  const generate = useCallback(async (input: MixInput): Promise<MixerResult> => {
    setIsPending(true);
    setError(null);
    try {
      const r = await mix(input);
      setResult(r);
      return r;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      throw e;
    } finally {
      setIsPending(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return { generate, isPending, error, result, reset };
}

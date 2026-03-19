'use client';

/**
 * Creatives SWR hooks.
 * Read hook for creative list + mutation hooks for status changes and creation.
 * Never imports from Next.js HTTP layer.
 */

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import {
  getCreatives,
  createCreative,
  updateCreative,
} from '@/frontend/api/content-pipeline/creatives';
import type {
  Creative,
  CreativeFilters,
  CreativeCreateInput,
  CreativeUpdateInput,
} from '@/lib/types/exploits';

// ─── Read hook ────────────────────────────────────────────────────────────────

export interface UseCreativesOptions extends CreativeFilters {
  enabled?: boolean;
}

export function useCreatives(options: UseCreativesOptions = {}) {
  const { enabled = true, ...filters } = options;

  const swrKey = enabled
    ? ['creatives', filters.status, filters.source_platform, filters.min_score, filters.limit]
    : null;

  const { data, error, isLoading, mutate } = useSWR<Creative[]>(
    swrKey,
    () => getCreatives(filters),
    { revalidateOnFocus: false }
  );

  const setCreatives = useCallback(
    (updater: React.SetStateAction<Creative[]>) => {
      if (typeof updater === 'function') {
        mutate((current) => updater(current ?? []), { revalidate: false });
      } else {
        mutate(updater, { revalidate: false });
      }
    },
    [mutate]
  );

  return {
    creatives: data ?? [],
    setCreatives,
    isLoading,
    error: error instanceof Error ? error : null,
    refetch: useCallback(async () => {
      await mutate();
    }, [mutate]),
  };
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

export function useUpdateCreative(onSuccess?: (creative: Creative) => void) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (id: string, body: CreativeUpdateInput) => {
      setIsPending(true);
      setError(null);
      try {
        const creative = await updateCreative(id, body);
        onSuccess?.(creative);
        return creative;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [onSuccess]
  );

  return { mutate, isPending, error };
}

export function useCreateCreative(onSuccess?: (creative: Creative) => void) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (body: CreativeCreateInput) => {
      setIsPending(true);
      setError(null);
      try {
        const creative = await createCreative(body);
        onSuccess?.(creative);
        return creative;
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        throw e;
      } finally {
        setIsPending(false);
      }
    },
    [onSuccess]
  );

  return { mutate, isPending, error };
}

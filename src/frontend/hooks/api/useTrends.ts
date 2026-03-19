'use client';

/**
 * Trends SWR hook.
 * Read-only access to trending topics from scanner data.
 */

import { useCallback } from 'react';
import useSWR from 'swr';
import { getTrends, type TrendingTopic } from '@/frontend/api/content-pipeline/trends';

export interface UseTrendsOptions {
  limit?: number;
  enabled?: boolean;
}

export function useTrends(options: UseTrendsOptions = {}) {
  const { limit = 12, enabled = true } = options;

  const swrKey = enabled ? ['trends', limit] : null;

  const { data, error, isLoading, mutate } = useSWR<TrendingTopic[]>(
    swrKey,
    () => getTrends(limit),
    { revalidateOnFocus: false }
  );

  return {
    topics: data ?? [],
    isLoading,
    error: error instanceof Error ? error : null,
    refetch: useCallback(async () => {
      await mutate();
    }, [mutate]),
  };
}

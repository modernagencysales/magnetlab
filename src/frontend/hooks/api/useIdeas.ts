'use client';

import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import { getIdeas } from '@/frontend/api/content-pipeline/ideas';
import type { ContentIdea } from '@/lib/types/content-pipeline';

export interface UseIdeasOptions {
  profileId?: string | null;
  teamId?: string;
  status?: string;
  pillar?: string;
  contentType?: string;
  limit?: number;
  /** When true, skip initial fetch (e.g. when server provides initialIdeas). */
  enabled?: boolean;
  /** Initial data from server; when set, initial fetch is skipped. */
  initialIdeas?: ContentIdea[];
}

export interface UseIdeasResult {
  ideas: ContentIdea[];
  allIdeas: ContentIdea[];
  setIdeas: React.Dispatch<React.SetStateAction<ContentIdea[]>>;
  setAllIdeas: React.Dispatch<React.SetStateAction<ContentIdea[]>>;
  isLoading: boolean;
  error: Error | null;
  refetch: (silent?: boolean) => Promise<void>;
  refetchWriting: () => Promise<void>;
}

export function useIdeas(options: UseIdeasOptions): UseIdeasResult {
  const {
    profileId,
    teamId,
    status,
    pillar,
    contentType,
    limit = 50,
    enabled = true,
    initialIdeas,
  } = options;

  // Stable SWR key — null disables fetching or when initialIdeas are provided
  const swrKey =
    enabled && initialIdeas === undefined
      ? ['ideas', status, pillar, contentType, profileId, teamId, limit]
      : null;

  const { data, error, isLoading, mutate } = useSWR<ContentIdea[]>(
    swrKey,
    () =>
      getIdeas({
        status,
        pillar,
        contentType,
        teamProfileId: profileId ?? undefined,
        teamId,
        limit,
      }),
    { revalidateOnFocus: false }
  );

  // allIdeas is the unfiltered full list — updated on unfilitered fetches
  const [allIdeas, setAllIdeas] = useState<ContentIdea[]>(initialIdeas ?? []);

  const ideas = data ?? initialIdeas ?? [];

  // Keep allIdeas in sync when there's no status filter
  useEffect(() => {
    if (data && !status) {
      setAllIdeas(data);
    }
  }, [data, status]);

  // Sync initialIdeas on mount / change
  useEffect(() => {
    if (initialIdeas !== undefined) {
      setAllIdeas(initialIdeas);
    }
  }, [initialIdeas]);

  const setIdeas = useCallback(
    (updater: React.SetStateAction<ContentIdea[]>) => {
      if (typeof updater === 'function') {
        mutate((current) => updater(current ?? []), { revalidate: false });
      } else {
        mutate(updater, { revalidate: false });
      }
    },
    [mutate]
  );

  const refetch = useCallback(
    async (_silent = false) => {
      await mutate();
    },
    [mutate]
  );

  const refetchWriting = useCallback(async () => {
    if (!enabled) return;
    try {
      const writingOnes = await getIdeas({
        status: 'writing',
        teamProfileId: profileId ?? undefined,
        teamId,
        limit,
      });
      setAllIdeas((prev) => {
        const nonWriting = prev.filter((i) => i.status !== 'writing');
        return [...writingOnes, ...nonWriting];
      });
    } catch {
      // Silent
    }
  }, [enabled, profileId, teamId, limit]);

  return {
    ideas,
    allIdeas,
    setIdeas,
    setAllIdeas,
    isLoading: initialIdeas !== undefined ? false : isLoading,
    error: error instanceof Error ? error : error ? new Error(String(error)) : null,
    refetch,
    refetchWriting,
  };
}

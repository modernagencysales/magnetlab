'use client';

import { useState, useEffect, useCallback } from 'react';
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

  const [ideas, setIdeas] = useState<ContentIdea[]>(initialIdeas ?? []);
  const [allIdeas, setAllIdeas] = useState<ContentIdea[]>(initialIdeas ?? []);
  const [isLoading, setIsLoading] = useState(initialIdeas === undefined && enabled);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(
    async (silent = false) => {
      if (!enabled) return;
      if (!silent) setIsLoading(true);
      setError(null);
      try {
        const fetched = await getIdeas({
          status,
          pillar,
          contentType,
          teamProfileId: profileId ?? undefined,
          teamId,
          limit,
        });
        setIdeas(fetched);
        if (!status) {
          setAllIdeas(fetched);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    },
    [enabled, profileId, teamId, limit, status, pillar, contentType]
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

  useEffect(() => {
    if (initialIdeas !== undefined) {
      setIdeas(initialIdeas);
      setAllIdeas(initialIdeas);
      setIsLoading(false);
      return;
    }
    if (enabled) {
      refetch();
    }
  }, [enabled, initialIdeas, refetch]);

  return {
    ideas,
    allIdeas,
    setIdeas,
    setAllIdeas,
    isLoading,
    error,
    refetch,
    refetchWriting,
  };
}

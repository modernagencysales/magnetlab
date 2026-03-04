'use client';

import { useState, useEffect, useCallback } from 'react';
import { getPosts } from '@/frontend/api/content-pipeline/posts';
import type { PipelinePost } from '@/lib/types/content-pipeline';

export interface UsePostsOptions {
  profileId?: string | null;
  teamId?: string;
  status?: string;
  isBuffer?: boolean;
  limit?: number;
  enabled?: boolean;
}

export interface UsePostsResult {
  posts: PipelinePost[];
  setPosts: React.Dispatch<React.SetStateAction<PipelinePost[]>>;
  isLoading: boolean;
  error: Error | null;
  refetch: (silent?: boolean) => Promise<void>;
}

export function usePosts(options: UsePostsOptions = {}): UsePostsResult {
  const {
    profileId,
    teamId,
    status,
    isBuffer = false,
    limit = 50,
    enabled = true,
  } = options;

  const [posts, setPosts] = useState<PipelinePost[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(
    async (silent = false) => {
      if (!enabled) return;
      if (!silent) setIsLoading(true);
      setError(null);
      try {
        const fetched = await getPosts({
          status,
          isBuffer,
          teamProfileId: profileId ?? undefined,
          teamId,
          limit,
        });
        setPosts(fetched);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    },
    [enabled, profileId, teamId, limit, status, isBuffer]
  );

  useEffect(() => {
    if (enabled) refetch();
  }, [enabled, refetch]);

  return { posts, setPosts, isLoading, error, refetch };
}

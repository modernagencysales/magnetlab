'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
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
  const { profileId, teamId, status, isBuffer = false, limit = 50, enabled = true } = options;

  // Stable SWR key — null disables fetching
  const swrKey = enabled ? ['posts', status, isBuffer, profileId, teamId, limit] : null;

  const { data, error, isLoading, mutate } = useSWR<PipelinePost[]>(
    swrKey,
    () =>
      getPosts({
        status,
        isBuffer,
        teamProfileId: profileId ?? undefined,
        teamId,
        limit,
      }),
    { revalidateOnFocus: false }
  );

  const posts = data ?? [];

  // Expose mutate as React.Dispatch-compatible setter for optimistic updates
  const setPosts = useCallback(
    (updater: React.SetStateAction<PipelinePost[]>) => {
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

  return {
    posts,
    setPosts,
    isLoading,
    error: error instanceof Error ? error : error ? new Error(String(error)) : null,
    refetch,
  };
}

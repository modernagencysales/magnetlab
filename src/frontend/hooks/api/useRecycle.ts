'use client';

/**
 * Recycle SWR hooks.
 * Read hook for recyclable posts + mutation hook for recycling.
 */

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import {
  getRecyclablePosts,
  recyclePost,
  type RecyclablePost,
} from '@/frontend/api/content-pipeline/recycle';
import type { PipelinePost } from '@/lib/types/content-pipeline';

export interface UseRecyclablePostsOptions {
  limit?: number;
  enabled?: boolean;
}

export function useRecyclablePosts(options: UseRecyclablePostsOptions = {}) {
  const { limit = 50, enabled = true } = options;

  const swrKey = enabled ? ['recyclable-posts', limit] : null;

  const { data, error, isLoading, mutate } = useSWR<RecyclablePost[]>(
    swrKey,
    () => getRecyclablePosts(limit),
    { revalidateOnFocus: false }
  );

  return {
    posts: data ?? [],
    isLoading,
    error: error instanceof Error ? error : null,
    refetch: useCallback(async () => {
      await mutate();
    }, [mutate]),
  };
}

export function useRecyclePost(onSuccess?: (post: PipelinePost) => void) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (postId: string, type: 'repost' | 'cousin') => {
      setIsPending(true);
      setError(null);
      try {
        const post = await recyclePost(postId, type);
        onSuccess?.(post);
        return post;
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

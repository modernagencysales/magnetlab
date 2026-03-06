'use client';

import { useState, useCallback } from 'react';
import {
  polishPost,
  updatePost,
  deletePost,
  type UpdatePostBody,
} from '@/frontend/api/content-pipeline/posts';
import type { PipelinePost } from '@/lib/types/content-pipeline';

export function usePolishPost(onSuccess?: () => void) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (postId: string) => {
      setIsPending(true);
      setError(null);
      try {
        await polishPost(postId);
        onSuccess?.();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [onSuccess]
  );

  return { mutate, isPending, error };
}

export function useUpdatePost(onSuccess?: (post: PipelinePost) => void) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (postId: string, body: UpdatePostBody) => {
      setIsPending(true);
      setError(null);
      try {
        const data = await updatePost(postId, body);
        onSuccess?.(data.post);
        return data;
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [onSuccess]
  );

  return { mutate, isPending, error };
}

export function useDeletePost(onSuccess?: () => void) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (postId: string) => {
      setIsPending(true);
      setError(null);
      try {
        await deletePost(postId);
        onSuccess?.();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setIsPending(false);
      }
    },
    [onSuccess]
  );

  return { mutate, isPending, error };
}

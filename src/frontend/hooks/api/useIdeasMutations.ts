'use client';

import { useState, useCallback } from 'react';
import { writeFromIdea, updateIdeaStatus } from '@/frontend/api/content-pipeline/ideas';

export function useWriteFromIdea(onSuccess?: () => void) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (ideaId: string, profileId?: string) => {
      setIsPending(true);
      setError(null);
      try {
        await writeFromIdea(ideaId, profileId);
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

export function useArchiveIdea(onSuccess?: () => void) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (ideaId: string) => {
      setIsPending(true);
      setError(null);
      try {
        await updateIdeaStatus({ ideaId, status: 'archived' });
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

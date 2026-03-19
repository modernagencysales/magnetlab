'use client';

/**
 * Generate mutation hook.
 * Triggers post generation from composable primitives.
 */

import { useCallback, useState } from 'react';
import { generatePost, type GeneratedPostResponse } from '@/frontend/api/content-pipeline/generate';
import type { GeneratePostInput } from '@/lib/types/exploits';

export function useGeneratePost(onSuccess?: (result: GeneratedPostResponse) => void) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (input: GeneratePostInput) => {
      setIsPending(true);
      setError(null);
      try {
        const result = await generatePost(input);
        onSuccess?.(result);
        return result;
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

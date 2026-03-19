'use client';

/**
 * Scanner SWR hooks.
 * Read hook for sources + mutation hooks for add/delete/run.
 */

import { useCallback, useState } from 'react';
import useSWR from 'swr';
import {
  getScannerSources,
  addScannerSource,
  deleteScannerSource,
  runScanner,
  type ScannerSource,
  type AddScannerSourceInput,
} from '@/frontend/api/content-pipeline/scanner';

// ─── Read hook ────────────────────────────────────────────────────────────────

export function useScannerSources() {
  const { data, error, isLoading, mutate } = useSWR<ScannerSource[]>(
    'scanner-sources',
    getScannerSources,
    { revalidateOnFocus: false }
  );

  return {
    sources: data ?? [],
    isLoading,
    error: error instanceof Error ? error : null,
    refetch: useCallback(async () => {
      await mutate();
    }, [mutate]),
  };
}

// ─── Mutation hooks ───────────────────────────────────────────────────────────

export function useAddScannerSource(onSuccess?: (source: ScannerSource) => void) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (body: AddScannerSourceInput) => {
      setIsPending(true);
      setError(null);
      try {
        const source = await addScannerSource(body);
        onSuccess?.(source);
        return source;
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

export function useDeleteScannerSource(onSuccess?: () => void) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (id: string) => {
      setIsPending(true);
      setError(null);
      try {
        await deleteScannerSource(id);
        onSuccess?.();
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

export function useRunScanner(onSuccess?: () => void) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async () => {
    setIsPending(true);
    setError(null);
    try {
      const result = await runScanner();
      onSuccess?.();
      return result;
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      throw e;
    } finally {
      setIsPending(false);
    }
  }, [onSuccess]);

  return { mutate, isPending, error };
}

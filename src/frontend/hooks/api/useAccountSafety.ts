'use client';

/**
 * SWR hook for account safety settings.
 * Provides data fetching with automatic caching, revalidation, and mutate helpers.
 */

import { useCallback } from 'react';
import useSWR from 'swr';
import { listAccountSettings } from '@/frontend/api/account-safety';
import type { AccountSafetySettingsResponse } from '@/frontend/api/account-safety';

// ─── useAccountSafetySettings ───────────────────────────────────────────────

export interface UseAccountSafetySettingsResult {
  settings: AccountSafetySettingsResponse[];
  isLoading: boolean;
  error: Error | null;
  mutate: () => Promise<void>;
}

export function useAccountSafetySettings(): UseAccountSafetySettingsResult {
  const {
    data,
    error,
    isLoading,
    mutate: swrMutate,
  } = useSWR('account-safety-settings', () => listAccountSettings(), { revalidateOnFocus: false });

  const mutate = useCallback(async () => {
    await swrMutate();
  }, [swrMutate]);

  return {
    settings: data?.settings ?? [],
    isLoading,
    error: error instanceof Error ? error : error ? new Error(String(error)) : null,
    mutate,
  };
}

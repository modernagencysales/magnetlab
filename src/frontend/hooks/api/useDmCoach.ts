'use client';

/**
 * SWR hooks for DM Coach.
 * Provides data fetching with automatic caching, revalidation, and mutate helpers.
 */

import { useCallback } from 'react';
import useSWR from 'swr';
import { listContacts, getContact } from '@/frontend/api/dm-coach';
import type { DmcContact, DmcMessage, DmcSuggestion } from '@/lib/types/dm-coach';

// ─── useDmCoachContacts ─────────────────────────────────────────────────────

export interface UseDmCoachContactsResult {
  contacts: DmcContact[];
  isLoading: boolean;
  error: Error | null;
  mutate: () => Promise<void>;
}

export function useDmCoachContacts(status?: string): UseDmCoachContactsResult {
  const swrKey = ['dm-coach-contacts', status ?? 'all'];

  const {
    data,
    error,
    isLoading,
    mutate: swrMutate,
  } = useSWR(swrKey, () => listContacts({ status }), { revalidateOnFocus: false });

  const mutate = useCallback(async () => {
    await swrMutate();
  }, [swrMutate]);

  return {
    contacts: data?.contacts ?? [],
    isLoading,
    error: error instanceof Error ? error : error ? new Error(String(error)) : null,
    mutate,
  };
}

// ─── useDmCoachContact ──────────────────────────────────────────────────────

export interface UseDmCoachContactResult {
  contact: DmcContact | undefined;
  messages: DmcMessage[];
  latestSuggestion: DmcSuggestion | null;
  isLoading: boolean;
  error: Error | null;
  mutate: () => Promise<void>;
}

export function useDmCoachContact(contactId: string | null): UseDmCoachContactResult {
  const swrKey = contactId ? ['dm-coach-contact', contactId] : null;

  const {
    data,
    error,
    isLoading,
    mutate: swrMutate,
  } = useSWR(swrKey, () => getContact(contactId!), { revalidateOnFocus: false });

  const mutate = useCallback(async () => {
    await swrMutate();
  }, [swrMutate]);

  return {
    contact: data?.contact,
    messages: data?.messages ?? [],
    latestSuggestion: data?.latest_suggestion ?? null,
    isLoading,
    error: error instanceof Error ? error : error ? new Error(String(error)) : null,
    mutate,
  };
}

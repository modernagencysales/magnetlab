'use client';

/**
 * SWR hooks for post campaigns.
 * Provides data fetching with automatic caching, revalidation, and mutate helpers.
 */

import { useCallback } from 'react';
import useSWR from 'swr';
import { listCampaigns, getCampaign, getCampaignLeads } from '@/frontend/api/post-campaigns';
import type { PostCampaignSummary, PostCampaignLead } from '@/frontend/api/post-campaigns';
import type { PostCampaign } from '@/lib/types/post-campaigns';

// ─── useCampaigns ───────────────────────────────────────────────────────────

export interface UseCampaignsResult {
  campaigns: PostCampaignSummary[];
  isLoading: boolean;
  error: Error | null;
  mutate: () => Promise<void>;
}

export function useCampaigns(status?: string): UseCampaignsResult {
  const swrKey = ['post-campaigns', status ?? 'all'];

  const {
    data,
    error,
    isLoading,
    mutate: swrMutate,
  } = useSWR(swrKey, () => listCampaigns(status), { revalidateOnFocus: false });

  const mutate = useCallback(async () => {
    await swrMutate();
  }, [swrMutate]);

  return {
    campaigns: data?.campaigns ?? [],
    isLoading,
    error: error instanceof Error ? error : error ? new Error(String(error)) : null,
    mutate,
  };
}

// ─── useCampaign ────────────────────────────────────────────────────────────

export interface UseCampaignResult {
  campaign: PostCampaign | undefined;
  leads: PostCampaignLead[];
  stats: Record<string, number>;
  isLoading: boolean;
  error: Error | null;
  mutate: () => Promise<void>;
}

export function useCampaign(id: string | null): UseCampaignResult {
  const swrKey = id ? ['post-campaign', id] : null;

  const {
    data,
    error,
    isLoading,
    mutate: swrMutate,
  } = useSWR(swrKey, () => getCampaign(id!), { revalidateOnFocus: false });

  const mutate = useCallback(async () => {
    await swrMutate();
  }, [swrMutate]);

  return {
    campaign: data?.campaign,
    leads: data?.leads ?? [],
    stats: data?.stats ?? {},
    isLoading,
    error: error instanceof Error ? error : error ? new Error(String(error)) : null,
    mutate,
  };
}

// ─── useCampaignLeads ───────────────────────────────────────────────────────

export interface UseCampaignLeadsResult {
  leads: PostCampaignLead[];
  isLoading: boolean;
  error: Error | null;
  mutate: () => Promise<void>;
}

export function useCampaignLeads(id: string | null, status?: string): UseCampaignLeadsResult {
  const swrKey = id ? ['post-campaign-leads', id, status ?? 'all'] : null;

  const {
    data,
    error,
    isLoading,
    mutate: swrMutate,
  } = useSWR(swrKey, () => getCampaignLeads(id!, status), { revalidateOnFocus: false });

  const mutate = useCallback(async () => {
    await swrMutate();
  }, [swrMutate]);

  return {
    leads: data?.leads ?? [],
    isLoading,
    error: error instanceof Error ? error : error ? new Error(String(error)) : null,
    mutate,
  };
}

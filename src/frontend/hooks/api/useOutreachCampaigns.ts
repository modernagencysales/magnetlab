'use client';

/**
 * SWR hooks for outreach campaigns.
 * Provides data fetching with automatic caching, revalidation, and mutate helpers.
 */

import { useCallback } from 'react';
import useSWR from 'swr';
import { listCampaigns, getCampaign, getCampaignLeads } from '@/frontend/api/outreach-campaigns';
import type {
  OutreachCampaignSummary,
  OutreachCampaignDetail,
  OutreachLeadSummary,
} from '@/frontend/api/outreach-campaigns';

// ─── useOutreachCampaigns ────────────────────────────────────────────────────

export interface UseOutreachCampaignsResult {
  campaigns: OutreachCampaignSummary[];
  isLoading: boolean;
  error: Error | null;
  mutate: () => Promise<void>;
}

export function useOutreachCampaigns(status?: string): UseOutreachCampaignsResult {
  const swrKey = ['outreach-campaigns', status ?? 'all'];

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

// ─── useOutreachCampaign ─────────────────────────────────────────────────────

export interface UseOutreachCampaignResult {
  campaign: OutreachCampaignDetail | undefined;
  isLoading: boolean;
  error: Error | null;
  mutate: () => Promise<void>;
}

export function useOutreachCampaign(id: string | null): UseOutreachCampaignResult {
  const swrKey = id ? ['outreach-campaign', id] : null;

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
    isLoading,
    error: error instanceof Error ? error : error ? new Error(String(error)) : null,
    mutate,
  };
}

// ─── useOutreachCampaignLeads ────────────────────────────────────────────────

export interface UseOutreachCampaignLeadsResult {
  leads: OutreachLeadSummary[];
  isLoading: boolean;
  error: Error | null;
  mutate: () => Promise<void>;
}

export function useOutreachCampaignLeads(
  campaignId: string | null,
  status?: string
): UseOutreachCampaignLeadsResult {
  const swrKey = campaignId ? ['outreach-campaign-leads', campaignId, status ?? 'all'] : null;

  const {
    data,
    error,
    isLoading,
    mutate: swrMutate,
  } = useSWR(swrKey, () => getCampaignLeads(campaignId!, status), { revalidateOnFocus: false });

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

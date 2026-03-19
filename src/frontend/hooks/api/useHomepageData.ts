/** useHomepageData. SWR hook for copilot homepage data. Constraint: Client-only. */

import useSWR from 'swr';

// ─── Types ────────────────────────────────────────────────

export interface Suggestion {
  label: string;
  action: string;
  priority: number;
}

export interface StatCard {
  key: string;
  label: string;
  value: number;
  change: string | null;
  changeType: 'positive' | 'negative' | 'neutral';
  period: string;
  sublabel?: string;
}

export interface RecentConversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface HomepageData {
  suggestions: Suggestion[];
  stats: StatCard[];
  recentConversations: RecentConversation[];
}

// ─── Fetcher ──────────────────────────────────────────────

const fetcher = async (url: string) => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
};

// ─── Hook ─────────────────────────────────────────────────

export function useHomepageData() {
  return useSWR<HomepageData>('/api/copilot/homepage-data', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
}

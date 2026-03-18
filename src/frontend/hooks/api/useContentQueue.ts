'use client';

import { useCallback } from 'react';
import useSWR from 'swr';
import { getQueue } from '@/frontend/api/content-queue';
import type { QueueListResult, QueueTeam } from '@/frontend/api/content-queue';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface UseContentQueueResult {
  data: QueueListResult | undefined;
  teams: QueueTeam[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  mutateTeam: (teamId: string, updater: (team: QueueTeam) => QueueTeam) => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

export function useContentQueue(): UseContentQueueResult {
  const { data, error, isLoading, mutate } = useSWR<QueueListResult>(
    'content-queue',
    () => getQueue(),
    { revalidateOnFocus: false }
  );

  const teams = data?.teams ?? [];

  const refetch = useCallback(async () => {
    await mutate();
  }, [mutate]);

  /**
   * Optimistically update a single team's data without revalidating.
   * Used when marking posts as edited to avoid a round-trip.
   */
  const mutateTeam = useCallback(
    (teamId: string, updater: (team: QueueTeam) => QueueTeam) => {
      mutate(
        (current) => {
          if (!current) return current;
          return {
            ...current,
            teams: current.teams.map((t) => (t.team_id === teamId ? updater(t) : t)),
          };
        },
        { revalidate: false }
      );
    },
    [mutate]
  );

  return {
    data,
    teams,
    isLoading,
    error: error instanceof Error ? error : error ? new Error(String(error)) : null,
    refetch,
    mutateTeam,
  };
}

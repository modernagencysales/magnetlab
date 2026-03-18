'use client';

/**
 * QueueView.
 * Landing state of the content queue — header with stats + list of ClientCard components.
 * Never fetches data; receives everything via props.
 */

import type { QueueTeam } from '@/frontend/api/content-queue';
import { ClientCard } from './ClientCard';

// ─── Types ─────────────────────────────────────────────────────────────────

interface QueueViewProps {
  teams: QueueTeam[];
  summary: {
    total_teams: number;
    total_posts: number;
    remaining: number;
    total_lead_magnets?: number;
    total_funnels?: number;
  };
  onEdit: (teamId: string) => void;
  onSubmitPosts: (teamId: string) => void;
  onSubmitAssets: (teamId: string) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function QueueView({
  teams,
  summary,
  onEdit,
  onSubmitPosts,
  onSubmitAssets,
}: QueueViewProps) {
  if (teams.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2">
        <p className="text-lg font-medium text-zinc-300">No posts in queue</p>
        <p className="text-sm text-zinc-500">
          Draft posts from your teams will appear here for editing.
        </p>
      </div>
    );
  }

  const totalLMs = summary.total_lead_magnets ?? 0;
  const totalFunnels = summary.total_funnels ?? 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">Content Queue</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {summary.total_teams} clients &middot; {summary.total_posts} posts &middot;{' '}
          {summary.remaining} remaining
          {totalLMs > 0 && (
            <>
              {' '}
              &middot; {totalLMs} lead magnet{totalLMs !== 1 ? 's' : ''}
            </>
          )}
          {totalFunnels > 0 && (
            <>
              {' '}
              &middot; {totalFunnels} funnel{totalFunnels !== 1 ? 's' : ''}
            </>
          )}
        </p>
      </div>

      {/* Client list */}
      <div className="flex flex-col gap-2">
        {teams.map((team) => (
          <ClientCard
            key={team.team_id}
            teamId={team.team_id}
            profileName={team.profile_name}
            profileCompany={team.profile_company}
            editedCount={team.edited_count}
            totalCount={team.total_count}
            lmReviewedCount={team.lm_reviewed_count ?? 0}
            lmTotalCount={team.lm_total_count ?? 0}
            funnelReviewedCount={team.funnel_reviewed_count ?? 0}
            funnelTotalCount={team.funnel_total_count ?? 0}
            onEdit={onEdit}
            onSubmitPosts={onSubmitPosts}
            onSubmitAssets={onSubmitAssets}
          />
        ))}
      </div>
    </div>
  );
}

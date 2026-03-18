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
  };
  onEdit: (teamId: string) => void;
  onSubmit: (teamId: string) => void;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function QueueView({ teams, summary, onEdit, onSubmit }: QueueViewProps) {
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-zinc-100">Content Queue</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {summary.total_teams} clients &middot; {summary.total_posts} posts &middot;{' '}
          {summary.remaining} remaining
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
            onEdit={onEdit}
            onSubmit={onSubmit}
          />
        ))}
      </div>
    </div>
  );
}

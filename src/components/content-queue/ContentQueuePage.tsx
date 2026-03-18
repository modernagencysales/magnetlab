'use client';

/**
 * ContentQueuePage.
 * Top-level client component for the content queue feature.
 * Manages state between QueueView and EditingView.
 * Never imports from server layer.
 */

import { useState, useCallback } from 'react';
import { useContentQueue } from '@/frontend/hooks/api/useContentQueue';
import { updateQueuePost, submitBatch } from '@/frontend/api/content-queue';
import { QueueView } from './QueueView';
import { EditingView } from './EditingView';

// ─── Component ─────────────────────────────────────────────────────────────

export function ContentQueuePage() {
  const { data, teams, isLoading, error, refetch, mutateTeam } = useContentQueue();
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  const editingTeam = editingTeamId
    ? (teams.find((t) => t.team_id === editingTeamId) ?? null)
    : null;

  // ─── Handlers ──────────────────────────────────────────────────────

  const handleEdit = useCallback((teamId: string) => {
    setEditingTeamId(teamId);
  }, []);

  const handleBack = useCallback(() => {
    setEditingTeamId(null);
  }, []);

  const handleSubmit = useCallback(
    async (teamId: string) => {
      const result = await submitBatch(teamId);
      if (result.success) {
        await refetch();
      }
      return result;
    },
    [refetch]
  );

  const handleMarkEdited = useCallback(
    async (postId: string) => {
      await updateQueuePost(postId, { mark_edited: true });
      // Optimistic update
      if (editingTeamId) {
        mutateTeam(editingTeamId, (team) => ({
          ...team,
          edited_count: team.edited_count + 1,
          posts: team.posts.map((p) =>
            p.id === postId ? { ...p, edited_at: new Date().toISOString() } : p
          ),
        }));
      }
    },
    [editingTeamId, mutateTeam]
  );

  const handleContentChange = useCallback(async (postId: string, content: string) => {
    await updateQueuePost(postId, { draft_content: content });
  }, []);

  // ─── Loading / Error states ────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-muted-foreground">Loading content queue...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-destructive">Failed to load queue: {error.message}</p>
      </div>
    );
  }

  // ─── Editing mode ──────────────────────────────────────────────────

  if (editingTeam) {
    return (
      <EditingView
        team={editingTeam}
        writingStyle={editingTeam.writing_style}
        onBack={handleBack}
        onMarkEdited={handleMarkEdited}
        onContentChange={handleContentChange}
      />
    );
  }

  // ─── Queue mode ────────────────────────────────────────────────────

  return (
    <QueueView
      teams={teams}
      summary={data?.summary ?? { total_teams: 0, total_posts: 0, remaining: 0 }}
      onEdit={handleEdit}
      onSubmit={handleSubmit}
    />
  );
}

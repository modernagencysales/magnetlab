'use client';

/**
 * ContentQueuePage.
 * Top-level client component for the content queue feature.
 * Manages state between QueueView, AssetPicker, and EditingView.
 * Never imports from server layer.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { useContentQueue } from '@/frontend/hooks/api/useContentQueue';
import {
  updateQueuePost,
  deleteQueuePost,
  submitBatch,
  reviewLeadMagnet,
  reviewFunnel,
} from '@/frontend/api/content-queue';
import { QueueView } from './QueueView';
import { EditingView } from './EditingView';
import { AssetPicker } from './AssetPicker';

// ─── Types ──────────────────────────────────────────────────────────────────

type EditingMode = null | 'picker' | 'posts';

// ─── Component ─────────────────────────────────────────────────────────────

export function ContentQueuePage() {
  const { data, teams, isLoading, error, refetch, mutateTeam } = useContentQueue();
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingMode, setEditingMode] = useState<EditingMode>(null);

  const editingTeam = editingTeamId
    ? (teams.find((t) => t.team_id === editingTeamId) ?? null)
    : null;

  // ─── Refs ────────────────────────────────────────────────────────────

  const contentChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Stash AI-generated original content per post — captured once when first loaded
  const originalContentRef = useRef<Map<string, string>>(new Map());

  // Populate original content snapshot when entering editing mode
  useEffect(() => {
    if (editingTeam) {
      for (const post of editingTeam.posts) {
        if (post.draft_content && !originalContentRef.current.has(post.id)) {
          originalContentRef.current.set(post.id, post.draft_content);
        }
      }
    }
  }, [editingTeam]);

  useEffect(() => {
    return () => {
      if (contentChangeTimeoutRef.current) clearTimeout(contentChangeTimeoutRef.current);
    };
  }, []);

  // ─── Navigation Handlers ────────────────────────────────────────────

  const handleEdit = useCallback((teamId: string) => {
    setEditingTeamId(teamId);
    setEditingMode('picker');
  }, []);

  // Go back to queue from picker or back to picker from posts editor
  const handleBack = useCallback(() => {
    if (editingMode === 'posts') {
      // Posts editor → back to picker
      setEditingMode('picker');
    } else {
      // Picker → back to queue
      setEditingTeamId(null);
      setEditingMode(null);
    }
  }, [editingMode]);

  const handleEditPosts = useCallback(() => {
    setEditingMode('posts');
  }, []);

  // ─── Submit Handlers ────────────────────────────────────────────────

  const handleSubmitPosts = useCallback(
    async (teamId: string) => {
      const result = await submitBatch(teamId, 'posts');
      if (result.success) {
        toast.success('Posts submitted for review');
        await refetch();
      }
      return result;
    },
    [refetch]
  );

  const handleSubmitAssets = useCallback(
    async (teamId: string) => {
      const result = await submitBatch(teamId, 'assets');
      if (result.success) {
        toast.success('Assets submitted for review');
        await refetch();
      }
      return result;
    },
    [refetch]
  );

  // ─── Review Handlers ────────────────────────────────────────────────

  const handleReviewLeadMagnet = useCallback(
    async (lmId: string, reviewed: boolean) => {
      try {
        await reviewLeadMagnet(lmId, reviewed);
        await refetch();
      } catch {
        toast.error('Failed to update lead magnet review status. Please try again.');
      }
    },
    [refetch]
  );

  const handleReviewFunnel = useCallback(
    async (funnelId: string, reviewed: boolean) => {
      try {
        await reviewFunnel(funnelId, reviewed);
        await refetch();
      } catch {
        toast.error('Failed to update funnel review status. Please try again.');
      }
    },
    [refetch]
  );

  // ─── Post Edit Handlers ─────────────────────────────────────────────

  const handleMarkEdited = useCallback(
    async (postId: string) => {
      // Optimistic update FIRST
      if (editingTeamId) {
        mutateTeam(editingTeamId, (team) => ({
          ...team,
          edited_count: team.edited_count + 1,
          posts: team.posts.map((p) =>
            p.id === postId ? { ...p, edited_at: new Date().toISOString() } : p
          ),
        }));
      }

      try {
        const originalContent = originalContentRef.current.get(postId);
        await updateQueuePost(postId, {
          mark_edited: true,
          ...(originalContent ? { original_content: originalContent } : {}),
        });
      } catch (err) {
        // Rollback optimistic update
        if (editingTeamId) {
          mutateTeam(editingTeamId, (team) => ({
            ...team,
            edited_count: team.edited_count - 1,
            posts: team.posts.map((p) => (p.id === postId ? { ...p, edited_at: null } : p)),
          }));
        }
        toast.error('Failed to mark post as edited. Please try again.');
        throw err;
      }
    },
    [editingTeamId, mutateTeam]
  );

  const handleDeletePost = useCallback(
    async (postId: string) => {
      try {
        await deleteQueuePost(postId);
        await refetch();
      } catch {
        toast.error('Failed to delete post. Please try again.');
        throw new Error('Delete failed');
      }
    },
    [refetch]
  );

  const handleContentChange = useCallback((postId: string, content: string) => {
    if (contentChangeTimeoutRef.current) {
      clearTimeout(contentChangeTimeoutRef.current);
    }
    contentChangeTimeoutRef.current = setTimeout(async () => {
      try {
        await updateQueuePost(postId, { draft_content: content });
      } catch {
        toast.error('Failed to save content. Please try again.');
      }
    }, 500);
  }, []);

  // ─── Loading / Error states ─────────────────────────────────────────

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

  // ─── Asset Picker mode ──────────────────────────────────────────────

  if (editingTeam && editingMode === 'picker') {
    return (
      <AssetPicker
        team={editingTeam}
        onEditPosts={handleEditPosts}
        onBack={handleBack}
        onReviewLeadMagnet={handleReviewLeadMagnet}
        onReviewFunnel={handleReviewFunnel}
        onSubmitPosts={async () => {
          await handleSubmitPosts(editingTeamId!);
        }}
        onSubmitAssets={async () => {
          await handleSubmitAssets(editingTeamId!);
        }}
      />
    );
  }

  // ─── Post editing mode ──────────────────────────────────────────────

  if (editingTeam && editingMode === 'posts') {
    return (
      <EditingView
        team={editingTeam}
        writingStyle={editingTeam.writing_style}
        onBack={handleBack}
        onMarkEdited={handleMarkEdited}
        onDeletePost={handleDeletePost}
        onContentChange={handleContentChange}
      />
    );
  }

  // ─── Queue mode ─────────────────────────────────────────────────────

  return (
    <QueueView
      teams={teams}
      summary={
        data?.summary ?? {
          total_teams: 0,
          total_posts: 0,
          remaining: 0,
          total_lead_magnets: 0,
          total_funnels: 0,
        }
      }
      onEdit={handleEdit}
      onSubmitPosts={handleSubmitPosts}
      onSubmitAssets={handleSubmitAssets}
    />
  );
}

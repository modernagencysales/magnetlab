'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Loader2, Copy, Check, Sparkles, Trash2, Eye } from 'lucide-react';
import { cn, truncate, formatDateTime } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { PostDetailModal } from './PostDetailModal';
import type { PipelinePost, PostStatus } from '@/lib/types/content-pipeline';

const STATUS_FILTERS: { value: PostStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'reviewing', label: 'In Review' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
];

interface PostsTabProps {
  profileId?: string | null;
}

export function PostsTab({ profileId }: PostsTabProps) {
  const [posts, setPosts] = useState<PipelinePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<PostStatus | ''>('');
  const [selectedPost, setSelectedPost] = useState<PipelinePost | null>(null);
  const [polishingId, setPolishingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchPosts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      params.append('is_buffer', 'false');
      if (profileId) params.append('team_profile_id', profileId);

      const response = await fetch(`/api/content-pipeline/posts?${params}`);
      const data = await response.json();
      setPosts(data.posts || []);
    } catch {
      // Silent failure
    } finally {
      setLoading(false);
    }
  }, [statusFilter, profileId]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handlePolish = async (postId: string) => {
    setPolishingId(postId);
    try {
      const response = await fetch(`/api/content-pipeline/posts/${postId}/polish`, {
        method: 'POST',
      });
      if (response.ok) {
        await fetchPosts(true);
        // Refresh the selected post if it's the one we polished
        if (selectedPost?.id === postId) {
          const detailRes = await fetch(`/api/content-pipeline/posts/${postId}`);
          const detailData = await detailRes.json();
          if (detailData.post) setSelectedPost(detailData.post);
        }
      }
    } catch {
      // Silent failure
    } finally {
      setPolishingId(null);
    }
  };

  const handleDelete = async (postId: string) => {
    // Optimistically remove from list
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      const response = await fetch(`/api/content-pipeline/posts/${postId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        await fetchPosts(true);
      }
    } catch {
      await fetchPosts(true);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Stats
  const stats = {
    draft: posts.filter((p) => p.status === 'draft').length,
    reviewing: posts.filter((p) => p.status === 'reviewing').length,
    scheduled: posts.filter((p) => p.status === 'scheduled').length,
    published: posts.filter((p) => p.status === 'published').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      {/* Stats */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Drafts</p>
          <p className="mt-1 text-2xl font-semibold">{stats.draft}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">In Review</p>
          <p className="mt-1 text-2xl font-semibold">{stats.reviewing}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Scheduled</p>
          <p className="mt-1 text-2xl font-semibold">{stats.scheduled}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Published</p>
          <p className="mt-1 text-2xl font-semibold">{stats.published}</p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="mb-6 flex gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
              statusFilter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Posts List */}
      {posts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">No posts found</p>
          <p className="mt-1 text-sm text-muted-foreground/70">
            Write posts from your ideas or run autopilot
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const content = post.final_content || post.draft_content || '';
            return (
              <div
                key={post.id}
                className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary/30"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="mb-2 flex items-center gap-2 flex-wrap">
                      <StatusBadge status={post.status} />
                      {(post as PipelinePost & { profile_name?: string | null }).profile_name && (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                          {(post as PipelinePost & { profile_name?: string | null }).profile_name}
                        </span>
                      )}
                      {post.hook_score !== null && post.hook_score !== undefined && (
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold',
                          post.hook_score >= 8 ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' :
                          post.hook_score >= 5 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' :
                          'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                        )}>
                          {post.hook_score}/10
                        </span>
                      )}
                      {post.scheduled_time && (
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(post.scheduled_time)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {truncate(content, 200)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setSelectedPost(post)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handlePolish(post.id)}
                      disabled={polishingId === post.id}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
                      title="Polish"
                    >
                      {polishingId === post.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => handleCopy(content, post.id)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                      title="Copy"
                    >
                      {copiedId === post.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onPolish={handlePolish}
          onUpdate={fetchPosts}
          polishing={polishingId === selectedPost.id}
        />
      )}
    </div>
  );
}

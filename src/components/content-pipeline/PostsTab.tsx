'use client';

import { useState } from 'react';
import {
  FileText,
  Loader2,
  Copy,
  Check,
  Sparkles,
  Trash2,
  Eye,
  List,
  LayoutGrid,
} from 'lucide-react';
import { Button, Badge } from '@magnetlab/magnetui';
import { cn, truncate, formatDateTime } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { PostDetailModal } from './PostDetailModal';
import { BatchView } from './BatchView';
import type { PipelinePost, PostStatus, ReviewData } from '@/lib/types/content-pipeline';
import { usePosts } from '@/frontend/hooks/api/usePosts';
import { usePolishPost, useDeletePost } from '@/frontend/hooks/api/usePostsMutations';
import { getPostById, updatePost } from '@/frontend/api/content-pipeline/posts';

const STATUS_FILTERS: { value: PostStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'reviewing', label: 'In Review' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
];

type ReviewCategory = 'excellent' | 'good_with_edits' | 'needs_rewrite' | '';

const REVIEW_FILTERS: { value: ReviewCategory; label: string; className: string }[] = [
  { value: '', label: 'All Reviews', className: '' },
  {
    value: 'excellent',
    label: 'Excellent',
    className: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  },
  {
    value: 'good_with_edits',
    label: 'Needs Edits',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  },
  {
    value: 'needs_rewrite',
    label: 'Rewrite',
    className: 'bg-destructive/10 text-destructive',
  },
];

interface PostsTabProps {
  profileId?: string | null;
  teamId?: string;
}

export function PostsTab({ profileId, teamId }: PostsTabProps) {
  const [statusFilter, setStatusFilter] = useState<PostStatus | ''>('');
  const [selectedPost, setSelectedPost] = useState<PipelinePost | null>(null);
  const [reviewFilter, setReviewFilter] = useState<ReviewCategory>('');
  const [polishingId, setPolishingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'batch'>('list');

  const {
    posts,
    setPosts,
    isLoading: loading,
    refetch: fetchPosts,
  } = usePosts({
    profileId,
    teamId,
    status: statusFilter || undefined,
    isBuffer: false,
  });

  const { mutate: polishMutate } = usePolishPost(async () => {
    await fetchPosts(true);
  });
  const { mutate: deleteMutate } = useDeletePost(() => fetchPosts(true));

  const handleStatusChange = async (postId: string, newStatus: PostStatus) => {
    try {
      await updatePost(postId, { status: newStatus });
      await fetchPosts(true);
    } catch {
      // Silent failure
    }
  };

  const handlePolish = async (postId: string) => {
    setPolishingId(postId);
    try {
      await polishMutate(postId);
      if (selectedPost?.id === postId) {
        const updated = await getPostById(postId);
        setSelectedPost(updated);
      }
    } catch {
      // Silent failure
    } finally {
      setPolishingId(null);
    }
  };

  const handleDelete = async (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      await deleteMutate(postId);
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
      <div className="mb-4 flex items-center gap-2">
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
        <div className="ml-auto flex items-center gap-1 rounded-lg border p-0.5">
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'rounded-md p-1.5 transition-colors',
              viewMode === 'list'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="List view"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('batch')}
            className={cn(
              'rounded-md p-1.5 transition-colors',
              viewMode === 'batch'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="Batch view"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Review Category Filter */}
      {posts.some((p) => p.review_data) && (
        <div className="mb-6 flex items-center gap-2">
          <span className="text-xs text-muted-foreground mr-1">Review:</span>
          {REVIEW_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setReviewFilter(f.value)}
              className={cn(
                'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                reviewFilter === f.value
                  ? f.className || 'bg-primary text-primary-foreground'
                  : 'bg-secondary/60 hover:bg-secondary/80 text-muted-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Posts List */}
      {(() => {
        const filteredPosts = reviewFilter
          ? posts.filter((p) => (p.review_data as ReviewData | null)?.category === reviewFilter)
          : posts;
        if (filteredPosts.length === 0) {
          return (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No posts found</p>
              <p className="mt-1 text-sm text-muted-foreground/70">
                Write posts from your ideas or run autopilot
              </p>
            </div>
          );
        }

        if (viewMode === 'batch') {
          return (
            <BatchView
              posts={filteredPosts}
              onOpenPost={setSelectedPost}
              onPolish={handlePolish}
              onDelete={handleDelete}
              onCopy={handleCopy}
              onStatusChange={handleStatusChange}
              polishingId={polishingId}
              copiedId={copiedId}
            />
          );
        }

        return (
          <div className="space-y-3">
            {filteredPosts.map((post) => {
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
                          <Badge variant="purple">
                            {(post as PipelinePost & { profile_name?: string | null }).profile_name}
                          </Badge>
                        )}
                        {post.hook_score !== null && post.hook_score !== undefined && (
                          <Badge
                            variant={
                              post.hook_score >= 8
                                ? 'green'
                                : post.hook_score >= 5
                                  ? 'orange'
                                  : 'red'
                            }
                          >
                            {post.hook_score}/10
                          </Badge>
                        )}
                        {post.review_data && (
                          <ReviewBadge reviewData={post.review_data as ReviewData} />
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
                      <ReviewNotes reviewData={post.review_data as ReviewData | null} />
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setSelectedPost(post)}
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handlePolish(post.id)}
                        disabled={polishingId === post.id}
                        title="Polish"
                      >
                        {polishingId === post.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleCopy(content, post.id)}
                        title="Copy"
                      >
                        {copiedId === post.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(post.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

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

// ─── Review Badge ─────────────────────────────────────────

const REVIEW_BADGE_VARIANTS: Record<string, 'green' | 'orange' | 'red'> = {
  excellent: 'green',
  good_with_edits: 'orange',
  needs_rewrite: 'red',
};

const REVIEW_CATEGORY_LABELS: Record<string, string> = {
  excellent: 'Excellent',
  good_with_edits: 'Needs Edits',
  needs_rewrite: 'Rewrite',
};

function ReviewBadge({ reviewData }: { reviewData: ReviewData }) {
  return (
    <Badge variant={REVIEW_BADGE_VARIANTS[reviewData.category] || 'orange'}>
      {REVIEW_CATEGORY_LABELS[reviewData.category] || reviewData.category} {reviewData.score}/10
    </Badge>
  );
}

function ReviewNotes({ reviewData }: { reviewData: ReviewData | null }) {
  if (!reviewData) return null;

  const hasNotes = reviewData.notes && reviewData.notes.length > 0;
  const hasFlags = reviewData.flags && reviewData.flags.length > 0;

  if (!hasNotes && !hasFlags) return null;

  return (
    <div className="mt-1">
      {hasNotes && (
        <details>
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            {reviewData.notes.length} edit suggestion{reviewData.notes.length !== 1 ? 's' : ''}
          </summary>
          <ul className="mt-1 space-y-1 pl-4">
            {reviewData.notes.map((note: string, i: number) => (
              <li key={i} className="text-xs text-muted-foreground">
                &bull; {note}
              </li>
            ))}
          </ul>
        </details>
      )}
      {hasFlags && (
        <details className={hasNotes ? 'mt-1' : ''}>
          <summary className="cursor-pointer text-xs text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300">
            {reviewData.flags.length} consistency flag{reviewData.flags.length !== 1 ? 's' : ''}
          </summary>
          <ul className="mt-1 space-y-1 pl-4">
            {reviewData.flags.map((flag: string, i: number) => (
              <li key={i} className="text-xs text-orange-600 dark:text-orange-400">
                &bull; {flag}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

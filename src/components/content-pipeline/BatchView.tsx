'use client';

import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Check,
  Copy,
  Eye,
  Loader2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import type { PipelinePost, PostStatus, ReviewData } from '@/lib/types/content-pipeline';

// ─── Review helpers (local, avoids creating shared module for ~30 lines) ───

// SYNC: also in PostsTab.tsx
const REVIEW_BADGE_STYLES: Record<string, string> = {
  excellent: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  good_with_edits: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300',
  needs_rewrite: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  delete: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

// SYNC: also in PostsTab.tsx
const REVIEW_CATEGORY_LABELS: Record<string, string> = {
  excellent: 'Excellent',
  good_with_edits: 'Needs Edits',
  needs_rewrite: 'Rewrite',
  delete: 'Delete',
};

function ReviewBadge({ reviewData }: { reviewData: ReviewData }) {
  const style = REVIEW_BADGE_STYLES[reviewData.category] || REVIEW_BADGE_STYLES.good_with_edits;
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', style)}>
      {REVIEW_CATEGORY_LABELS[reviewData.category] || reviewData.category} {reviewData.score}/10
    </span>
  );
}

function ReviewNotes({ reviewData }: { reviewData: ReviewData | null }) {
  if (!reviewData) return null;
  const hasNotes = reviewData.notes && reviewData.notes.length > 0;
  const hasFlags = reviewData.flags && reviewData.flags.length > 0;
  if (!hasNotes && !hasFlags) return null;

  return (
    <div className="mt-2">
      {hasNotes && (
        <details>
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            {reviewData.notes.length} edit suggestion{reviewData.notes.length !== 1 ? 's' : ''}
          </summary>
          <ul className="mt-1 space-y-1 pl-4">
            {reviewData.notes.map((note: string, i: number) => (
              <li key={i} className="text-xs text-muted-foreground">&bull; {note}</li>
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
              <li key={i} className="text-xs text-orange-600 dark:text-orange-400">&bull; {flag}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ─── BatchView ────────────────────────────────────────────

interface BatchViewProps {
  posts: PipelinePost[];
  onOpenPost: (post: PipelinePost) => void;
  onPolish: (postId: string) => void;
  onDelete: (postId: string) => void;
  onCopy: (text: string, id: string) => void;
  onStatusChange: (postId: string, newStatus: PostStatus) => void;
  polishingId: string | null;
  copiedId: string | null;
}

export function BatchView({
  posts,
  onOpenPost,
  onPolish,
  onDelete,
  onCopy,
  onStatusChange,
  polishingId,
  copiedId,
}: BatchViewProps) {
  const [allExpanded, setAllExpanded] = useState(true);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const toggleCard = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExpandAll = () => {
    setAllExpanded(true);
    setCollapsedIds(new Set());
  };

  const handleCollapseAll = () => {
    setAllExpanded(false);
    setCollapsedIds(new Set(posts.map((p) => p.id)));
  };

  const isExpanded = (id: string) => !collapsedIds.has(id);

  // Aggregate stats
  const statusCounts: Record<string, number> = {};
  const reviewCounts: Record<string, number> = {};
  for (const p of posts) {
    statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
    const rd = p.review_data as ReviewData | null;
    if (rd?.category) {
      reviewCounts[rd.category] = (reviewCounts[rd.category] || 0) + 1;
    }
  }

  return (
    <div>
      {/* Aggregate stats bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 text-sm">
        <span className="font-medium">{posts.length} posts</span>
        <span className="text-muted-foreground">|</span>
        {Object.entries(statusCounts).map(([status, count]) => (
          <span key={status} className="flex items-center gap-1">
            <StatusBadge status={status} /> <span className="text-muted-foreground">{count}</span>
          </span>
        ))}
        {Object.keys(reviewCounts).length > 0 && (
          <>
            <span className="text-muted-foreground">|</span>
            {Object.entries(reviewCounts).map(([cat, count]) => (
              <span key={cat} className={cn('rounded-full px-2 py-0.5 text-xs font-medium', REVIEW_BADGE_STYLES[cat])}>
                {REVIEW_CATEGORY_LABELS[cat] || cat}: {count}
              </span>
            ))}
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={handleExpandAll}
            className={cn(
              'rounded px-2 py-1 text-xs font-medium transition-colors',
              allExpanded && collapsedIds.size === 0
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80'
            )}
          >
            <ChevronDown className="mr-1 inline h-3 w-3" />
            Expand All
          </button>
          <button
            onClick={handleCollapseAll}
            className={cn(
              'rounded px-2 py-1 text-xs font-medium transition-colors',
              !allExpanded && collapsedIds.size === posts.length
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary hover:bg-secondary/80'
            )}
          >
            <ChevronUp className="mr-1 inline h-3 w-3" />
            Collapse All
          </button>
        </div>
      </div>

      {/* Post cards */}
      <div className="space-y-3">
        {posts.map((post) => {
          const content = post.final_content || post.draft_content || '';
          const expanded = isExpanded(post.id);

          return (
            <div
              key={post.id}
              className="rounded-lg border bg-card transition-colors"
            >
              {/* Card header — always visible, clickable to toggle */}
              <button
                onClick={() => toggleCard(post.id)}
                className="flex w-full items-center gap-2 p-4 text-left hover:bg-secondary/30 transition-colors"
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="flex flex-1 items-center gap-2 flex-wrap min-w-0">
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
                  {post.review_data && (
                    <ReviewBadge reviewData={post.review_data as ReviewData} />
                  )}
                  {post.scheduled_time && (
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(post.scheduled_time)}
                    </span>
                  )}
                  {!expanded && (
                    <span className="truncate text-xs text-muted-foreground">
                      {content.slice(0, 80)}{content.length > 80 ? '...' : ''}
                    </span>
                  )}
                </div>

                {/* Inline actions (stop propagation so clicks don't toggle) */}
                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  {post.status !== 'approved' && post.status !== 'published' && (
                    <button
                      onClick={() => onStatusChange(post.id, 'approved')}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-950 dark:hover:text-green-300 transition-colors"
                      title="Approve"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => onOpenPost(post)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                    title="Open / Edit"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onPolish(post.id)}
                    disabled={polishingId === post.id}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
                    title="Polish"
                  >
                    {polishingId === post.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => onCopy(content, post.id)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                    title="Copy"
                  >
                    {copiedId === post.id ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => onDelete(post.id)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </button>

              {/* Expanded content */}
              {expanded && (
                <div className="border-t px-4 pb-4 pt-3">
                  <p className="text-sm whitespace-pre-line">{content}</p>
                  <ReviewNotes reviewData={post.review_data as ReviewData | null} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

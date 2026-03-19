'use client';

/**
 * PostList.
 * Left column of the editing view — numbered list of posts with status dots.
 * Never fetches data; receives everything via props.
 */

import { ArrowLeft } from 'lucide-react';
import type { QueuePost } from '@/frontend/api/content-queue';

// ─── Types ─────────────────────────────────────────────────────────────────

interface PostListProps {
  posts: QueuePost[];
  currentIndex: number;
  onSelect: (index: number) => void;
  onBack: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function getStatusColor(post: QueuePost, index: number, currentIndex: number): string {
  if (index === currentIndex) return 'bg-amber-400';
  if (post.edited_at) return 'bg-emerald-400';
  return 'bg-muted-foreground';
}

function truncateFirstLine(content: string | null, maxLen = 40): string {
  if (!content) return '(empty)';
  const firstLine = content.split('\n')[0] ?? '';
  return firstLine.length > maxLen ? firstLine.slice(0, maxLen) + '...' : firstLine;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function PostList({ posts, currentIndex, onSelect, onBack }: PostListProps) {
  return (
    <div className="flex h-full w-[200px] shrink-0 flex-col border-r border-border bg-muted">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 border-b border-border px-3 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Queue
      </button>

      {/* Post items */}
      <div className="flex-1 overflow-y-auto">
        {posts.map((post, index) => (
          <button
            key={post.id}
            type="button"
            onClick={() => onSelect(index)}
            className={`flex w-full items-start gap-2 px-3 py-2 text-left text-xs transition-colors ${
              index === currentIndex
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
            }`}
          >
            {/* Status dot */}
            <div className="mt-1 flex shrink-0 items-center gap-1.5">
              <span className="text-muted-foreground">{index + 1}.</span>
              <div
                className={`h-2 w-2 rounded-full ${getStatusColor(post, index, currentIndex)}`}
              />
            </div>

            {/* Truncated content */}
            <span className="truncate">{truncateFirstLine(post.draft_content)}</span>
          </button>
        ))}
      </div>

      {/* Status legend */}
      <div className="border-t border-border px-3 py-2">
        <div className="flex flex-col gap-1 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Edited
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            Current
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            Unedited
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { Loader2 } from 'lucide-react';
import { truncate } from '@/lib/utils';
import { PillarBadge } from './PillarBadge';
import type { ContentPillar } from '@/lib/types/content-pipeline';

interface BufferQueueCardProps {
  post: {
    id: string;
    final_content: string | null;
    draft_content: string | null;
    hook_score: number | null;
    buffer_position: number | null;
    idea_id: string | null;
  };
  pillar?: ContentPillar | null;
  position: number;
  onApprove: (postId: string) => void;
  onReject: (postId: string) => void;
  approving: boolean;
  rejecting: boolean;
}

export function BufferQueueCard({ post, pillar, position, onApprove, onReject, approving, rejecting }: BufferQueueCardProps) {
  const content = post.final_content || post.draft_content || '';

  return (
    <div className="flex items-center gap-4 rounded-lg border bg-card p-4">
      {/* Position */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
        {position}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm line-clamp-2">{truncate(content, 100)}</p>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {post.hook_score !== null && post.hook_score !== undefined && (
            <span className="text-xs text-muted-foreground">
              Hook: {post.hook_score}/10
            </span>
          )}
          <PillarBadge pillar={pillar} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onApprove(post.id)}
          disabled={approving || rejecting}
          className="flex items-center gap-1.5 rounded-lg bg-green-600 dark:bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 transition-colors"
        >
          {approving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Approve'}
        </button>
        <button
          onClick={() => onReject(post.id)}
          disabled={approving || rejecting}
          className="flex items-center gap-1.5 rounded-lg bg-red-600 dark:bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 transition-colors"
        >
          {rejecting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Reject'}
        </button>
      </div>
    </div>
  );
}

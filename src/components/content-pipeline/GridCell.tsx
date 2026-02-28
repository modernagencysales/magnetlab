'use client';

import { cn } from '@/lib/utils';
import { Users } from 'lucide-react';
import type { PipelinePost } from '@/lib/types/content-pipeline';

interface GridCellProps {
  post: PipelinePost | null;
  slotTime: string | null; // "HH:MM" or null if no slot
  hasSlot: boolean;
  onCellClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isToday: boolean;
}

/**
 * Status color mapping for the post card left border / dot.
 * scheduled + approved = green; reviewing + draft = yellow/amber.
 */
function getStatusColor(status: string): string {
  switch (status) {
    case 'scheduled':
    case 'approved':
      return 'border-l-green-500';
    case 'reviewing':
    case 'draft':
      return 'border-l-amber-400';
    case 'published':
      return 'border-l-blue-500';
    default:
      return 'border-l-zinc-300 dark:border-l-zinc-600';
  }
}

function getStatusDotColor(status: string): string {
  switch (status) {
    case 'scheduled':
    case 'approved':
      return 'bg-green-500';
    case 'reviewing':
    case 'draft':
      return 'bg-amber-400';
    case 'published':
      return 'bg-blue-500';
    default:
      return 'bg-zinc-400';
  }
}

/**
 * Extract the first line of post content and truncate to maxLen characters.
 */
function hookPreview(post: PipelinePost, maxLen = 60): string {
  const raw = post.final_content || post.draft_content || '';
  const firstLine = raw.split('\n').find((l) => l.trim().length > 0) || '';
  if (firstLine.length <= maxLen) return firstLine;
  return firstLine.slice(0, maxLen).trimEnd() + '...';
}

/**
 * Format an "HH:MM" 24-hour time string into a friendlier display.
 */
function formatSlotTime(time: string): string {
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr || '00';
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${suffix}`;
}

export function GridCell({ post, slotTime, hasSlot, onCellClick, onContextMenu, isToday }: GridCellProps) {
  // No slot — blank cell
  if (!hasSlot && !post) {
    return (
      <div
        className={cn(
          'min-h-[72px] rounded-md',
          isToday ? 'bg-blue-50/40 dark:bg-blue-950/20' : 'bg-transparent'
        )}
      />
    );
  }

  // Empty slot — dashed placeholder
  if (hasSlot && !post) {
    return (
      <button
        type="button"
        onClick={onCellClick}
        className={cn(
          'flex min-h-[72px] w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50',
          isToday && 'ring-2 ring-blue-400/30'
        )}
      >
        {slotTime && (
          <span className="text-[10px] font-medium">{formatSlotTime(slotTime)}</span>
        )}
        <span className="text-[10px]">+ Assign</span>
      </button>
    );
  }

  // Post card
  if (post) {
    const preview = hookPreview(post);
    const time = post.scheduled_time
      ? new Date(post.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : slotTime
        ? formatSlotTime(slotTime)
        : null;

    return (
      <button
        type="button"
        onClick={onCellClick}
        onContextMenu={onContextMenu}
        className={cn(
          'flex min-h-[72px] w-full flex-col gap-1 rounded-md border-l-[3px] bg-card p-1.5 text-left shadow-sm transition-colors hover:bg-muted/50',
          getStatusColor(post.status),
          isToday && 'ring-2 ring-blue-400/40'
        )}
      >
        {/* Top row: time + status dot */}
        <div className="flex items-center gap-1.5">
          <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', getStatusDotColor(post.status))} />
          {time && (
            <span className="text-[10px] text-muted-foreground">{time}</span>
          )}
        </div>

        {/* Hook preview */}
        {preview && (
          <p className="text-[11px] leading-tight line-clamp-2 font-medium">
            {preview}
          </p>
        )}

        {/* Bottom row: broadcast badge */}
        {post.broadcast_group_id && (
          <div className="flex items-center gap-0.5 mt-auto">
            <Users className="h-2.5 w-2.5 text-purple-500" />
            <span className="text-[9px] text-purple-600 dark:text-purple-400 font-medium">Broadcast</span>
          </div>
        )}
      </button>
    );
  }

  return null;
}

'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { PipelinePost } from '@/lib/types/content-pipeline';

interface KanbanCardProps {
  post: PipelinePost;
  selected: boolean;
  onToggleSelect: () => void;
  onStatusChange: (status: string) => void;
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Ideas' },
  { value: 'reviewing', label: 'Written' },
  { value: 'approved', label: 'Review' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'failed', label: 'Failed' },
];

export function KanbanCard({ post, selected, onToggleSelect, onStatusChange }: KanbanCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const content = post.final_content || post.draft_content || '';
  const firstLine = content.split('\n')[0]?.substring(0, 80) || 'Untitled post';

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-3 transition-colors',
        selected && 'ring-2 ring-primary'
      )}
    >
      <div className="mb-1.5 flex items-start gap-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <p className="flex-1 text-xs leading-snug line-clamp-2">{firstLine}</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {post.hook_score !== null && post.hook_score !== undefined && (
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
              post.hook_score >= 8 ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' :
              post.hook_score >= 5 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' :
              'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
            )}>
              {post.hook_score}
            </span>
          )}
          {post.template_id && (
            <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] text-purple-700 dark:bg-purple-950 dark:text-purple-300">T</span>
          )}
          {post.style_id && (
            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700 dark:bg-blue-950 dark:text-blue-300">S</span>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary transition-colors"
          >
            Move
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full z-10 mt-1 min-w-[120px] rounded-lg border bg-background py-1 shadow-lg">
              {STATUS_OPTIONS
                .filter((o) => o.value !== post.status)
                .map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      onStatusChange(option.value);
                      setShowMenu(false);
                    }}
                    className="block w-full px-3 py-1 text-left text-xs hover:bg-muted transition-colors"
                  >
                    {option.label}
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

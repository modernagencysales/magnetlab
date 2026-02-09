'use client';

import type { PipelinePost } from '@/lib/types/content-pipeline';
import { KanbanCard } from './KanbanCard';

interface KanbanColumnProps {
  label: string;
  posts: PipelinePost[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
}

export function KanbanColumn({ label, posts, selectedIds, onToggleSelect, onStatusChange }: KanbanColumnProps) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold">{label}</h4>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium">{posts.length}</span>
      </div>
      <div className="space-y-2">
        {posts.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No posts</p>
        ) : (
          posts.map((post) => (
            <KanbanCard
              key={post.id}
              post={post}
              selected={selectedIds.has(post.id)}
              onToggleSelect={() => onToggleSelect(post.id)}
              onStatusChange={(status) => onStatusChange(post.id, status)}
            />
          ))
        )}
      </div>
    </div>
  );
}

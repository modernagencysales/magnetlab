'use client';

import { useState, useRef } from 'react';
import { GripVertical, MoreVertical, PenLine, Archive, Trash2, Clock, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PillarBadge } from './PillarBadge';
import type { ContentIdea, PipelinePost } from '@/lib/types/content-pipeline';

// ─── Types ────────────────────────────────────────────────

export type CardItem =
  | { type: 'idea'; data: ContentIdea }
  | { type: 'post'; data: PipelinePost };

interface KanbanCardProps {
  item: CardItem;
  selected: boolean;
  previewActive: boolean;
  dragging: boolean;
  onToggleSelect: (e: React.MouseEvent) => void;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onAction: (action: string) => void;
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  story: 'Story',
  insight: 'Insight',
  tip: 'Tip',
  framework: 'Framework',
  case_study: 'Case Study',
  question: 'Question',
  listicle: 'Listicle',
  contrarian: 'Contrarian',
};

export function KanbanCard({
  item,
  selected,
  previewActive,
  dragging,
  onToggleSelect,
  onClick,
  onDragStart,
  onAction,
}: KanbanCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={cn(
        'group cursor-pointer rounded-lg border bg-card p-3 transition-all',
        'hover:shadow-sm hover:border-border/80',
        selected && 'ring-2 ring-primary',
        previewActive && 'border-primary bg-primary/5',
        dragging && 'opacity-50'
      )}
    >
      {/* Top row: drag handle + checkbox + content */}
      <div className="mb-2 flex items-start gap-2">
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity" />
        <input
          type="checkbox"
          checked={selected}
          onChange={() => {}}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(e);
          }}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-primary focus:ring-primary"
        />
        <div className="min-w-0 flex-1">
          {item.type === 'idea' ? (
            <IdeaContent idea={item.data} />
          ) : (
            <PostContent post={item.data} />
          )}
        </div>

        {/* Three-dot menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="rounded p-1 text-muted-foreground/40 hover:bg-secondary hover:text-muted-foreground opacity-0 group-hover:opacity-100 transition-all"
          >
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setShowMenu(false); }} />
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[140px] rounded-lg border bg-background py-1 shadow-lg">
                {item.type === 'idea' ? (
                  <>
                    <MenuButton icon={<PenLine className="h-3.5 w-3.5" />} label="Write Now" onClick={() => { onAction('write'); setShowMenu(false); }} />
                    <MenuButton icon={<Archive className="h-3.5 w-3.5" />} label="Archive" onClick={() => { onAction('archive'); setShowMenu(false); }} />
                    <MenuButton icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />} label="Delete" className="text-red-600" onClick={() => { onAction('delete'); setShowMenu(false); }} />
                  </>
                ) : (
                  <>
                    <MenuButton icon={<PenLine className="h-3.5 w-3.5" />} label="Edit" onClick={() => { onAction('edit'); setShowMenu(false); }} />
                    <MenuButton icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />} label="Delete" className="text-red-600" onClick={() => { onAction('delete'); setShowMenu(false); }} />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom badges */}
      <div className="flex items-center gap-1.5 pl-10">
        {item.type === 'idea' ? (
          <IdeaBadges idea={item.data} />
        ) : (
          <PostBadges post={item.data} />
        )}
      </div>
    </div>
  );
}

// ─── Idea content ─────────────────────────────────────────

function IdeaContent({ idea }: { idea: ContentIdea }) {
  return (
    <div>
      <p className="text-xs font-semibold leading-snug line-clamp-2">{idea.title}</p>
      {idea.core_insight && (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground line-clamp-2">{idea.core_insight}</p>
      )}
      {idea.why_post_worthy && (
        <p className="mt-1 text-[11px] italic leading-snug text-violet-600 dark:text-violet-400 line-clamp-1">{idea.why_post_worthy}</p>
      )}
    </div>
  );
}

function IdeaBadges({ idea }: { idea: ContentIdea }) {
  return (
    <>
      <PillarBadge pillar={idea.content_pillar} className="text-[10px] px-1.5 py-0.5" />
      {idea.content_type && (
        <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {CONTENT_TYPE_LABELS[idea.content_type] || idea.content_type}
        </span>
      )}
    </>
  );
}

// ─── Post content ─────────────────────────────────────────

function PostContent({ post }: { post: PipelinePost }) {
  const content = post.final_content || post.draft_content || '';
  const firstLine = content.split('\n')[0]?.substring(0, 80) || 'Untitled post';

  return (
    <div>
      <p className="text-xs font-semibold leading-snug line-clamp-2">{firstLine}</p>
      {content.split('\n').length > 1 && (
        <p className="mt-1 text-[11px] leading-snug text-muted-foreground line-clamp-2">
          {content.split('\n').slice(1).join(' ').substring(0, 120)}
        </p>
      )}
    </div>
  );
}

function PostBadges({ post }: { post: PipelinePost }) {
  return (
    <>
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
      {post.scheduled_time && (
        <span className="flex items-center gap-0.5 rounded-full bg-cyan-100 px-1.5 py-0.5 text-[10px] text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
          <Clock className="h-2.5 w-2.5" />
          {new Date(post.scheduled_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
      )}
      {post.enable_automation && (
        <span className="flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          <Zap className="h-2.5 w-2.5" />
        </span>
      )}
    </>
  );
}

// ─── Menu Button ──────────────────────────────────────────

function MenuButton({ icon, label, className, onClick }: { icon: React.ReactNode; label: string; className?: string; onClick: () => void }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn('flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted transition-colors', className)}
    >
      {icon}
      {label}
    </button>
  );
}

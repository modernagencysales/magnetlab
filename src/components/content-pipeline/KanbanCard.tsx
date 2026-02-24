'use client';

import { useState } from 'react';
import { MoreVertical, PenLine, Archive, Trash2, Clock, Zap, Linkedin, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PillarBadge } from './PillarBadge';
import type { ContentIdea, PipelinePost } from '@/lib/types/content-pipeline';

// ─── Types ────────────────────────────────────────────────

export type CardItem =
  | { type: 'idea'; data: ContentIdea }
  | { type: 'post'; data: PipelinePost };

interface FocusedCardProps {
  item: CardItem;
  selected: boolean;
  previewActive: boolean;
  onToggleSelect: (e: React.MouseEvent) => void;
  onClick: () => void;
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

// ─── Full-width focused card (horizontal row) ─────────────

export function FocusedCard({
  item,
  selected,
  previewActive,
  onToggleSelect,
  onClick,
  onAction,
}: FocusedCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex items-start gap-3 rounded-lg border bg-card p-3 cursor-pointer transition-all',
        'hover:shadow-sm hover:border-border/80',
        selected && 'ring-2 ring-primary bg-primary/5',
        previewActive && 'border-primary bg-primary/5',
      )}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={selected}
        onChange={() => {}}
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect(e);
        }}
        className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-primary focus:ring-primary"
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        {item.type === 'idea' ? (
          <IdeaRow idea={item.data} />
        ) : (
          <PostRow post={item.data} />
        )}
      </div>

      {/* Quick actions (visible on hover) */}
      <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {item.type === 'idea' ? (
          <button
            onClick={(e) => { e.stopPropagation(); onAction('write'); }}
            className="flex items-center gap-1.5 rounded-md bg-green-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-green-700 transition-colors"
          >
            <PenLine className="h-3 w-3" />
            Write
          </button>
        ) : (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); onAction('edit'); }}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] font-medium hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Edit
            </button>
            {['draft', 'reviewing', 'approved'].includes(
              (item.data as PipelinePost).status
            ) && (
              <button
                onClick={(e) => { e.stopPropagation(); onAction('publish'); }}
                className="flex items-center gap-1 rounded-md bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Linkedin className="h-3 w-3" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Three-dot menu */}
      <div className="relative shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
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
                  {['draft', 'reviewing', 'approved'].includes(
                    (item.data as PipelinePost).status
                  ) && (
                    <MenuButton icon={<Linkedin className="h-3.5 w-3.5 text-blue-600" />} label="Publish" onClick={() => { onAction('publish'); setShowMenu(false); }} />
                  )}
                  <MenuButton icon={<Trash2 className="h-3.5 w-3.5 text-red-500" />} label="Delete" className="text-red-600" onClick={() => { onAction('delete'); setShowMenu(false); }} />
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Idea row (horizontal layout) ─────────────────────────

function IdeaRow({ idea }: { idea: ContentIdea }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-0.5">
        <p className="text-sm font-semibold leading-snug line-clamp-1 flex-1">{idea.title}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          <PillarBadge pillar={idea.content_pillar} className="text-[10px] px-1.5 py-0.5" />
          {idea.content_type && (
            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {CONTENT_TYPE_LABELS[idea.content_type] || idea.content_type}
            </span>
          )}
          {idea.composite_score != null && (
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
              idea.composite_score >= 7 ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' :
              idea.composite_score >= 4 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' :
              'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
            )}>
              {idea.composite_score.toFixed(1)}
            </span>
          )}
        </div>
      </div>
      {idea.core_insight && (
        <p className="text-xs text-muted-foreground line-clamp-1">{idea.core_insight}</p>
      )}
      {idea.why_post_worthy && (
        <p className="text-[11px] italic text-violet-600 dark:text-violet-400 line-clamp-1 mt-0.5">
          {idea.why_post_worthy}
        </p>
      )}
    </div>
  );
}

// ─── Post row (horizontal layout) ─────────────────────────

function PostRow({ post }: { post: PipelinePost }) {
  const content = post.final_content || post.draft_content || '';
  const firstLine = content.split('\n')[0]?.substring(0, 120) || 'Untitled post';

  return (
    <div>
      <div className="flex items-center gap-2 mb-0.5">
        <p className="text-sm font-semibold leading-snug line-clamp-1 flex-1">{firstLine}</p>
        <div className="flex items-center gap-1.5 shrink-0">
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
      </div>
      {content.split('\n').length > 1 && (
        <p className="text-xs text-muted-foreground line-clamp-1">
          {content.split('\n').slice(1).join(' ').substring(0, 150)}
        </p>
      )}
      <div className="flex items-center gap-2 mt-0.5">
        {post.scheduled_time && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Clock className="h-2.5 w-2.5" />
            {new Date(post.scheduled_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </span>
        )}
        {post.enable_automation && (
          <span className="flex items-center gap-0.5 text-[10px] text-amber-600 dark:text-amber-400">
            <Zap className="h-2.5 w-2.5" />
            Auto
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Menu button ──────────────────────────────────────────

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

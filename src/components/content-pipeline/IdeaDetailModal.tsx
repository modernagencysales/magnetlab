'use client';

import { X, Loader2, Archive } from 'lucide-react';
import { StatusBadge } from './StatusBadge';
import { PillarBadge } from './PillarBadge';
import type { ContentIdea } from '@/lib/types/content-pipeline';

interface IdeaDetailModalProps {
  idea: ContentIdea;
  onClose: () => void;
  onWritePost: (ideaId: string) => void;
  onArchive: (ideaId: string) => void;
  writing: boolean;
  archiving: boolean;
}

export function IdeaDetailModal({ idea, onClose, onWritePost, onArchive, writing, archiving }: IdeaDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Idea Details">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Idea Details</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Status & Pillar */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={idea.status} />
            <PillarBadge pillar={idea.content_pillar} />
            {idea.content_type && (
              <span className="rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground">
                {idea.content_type}
              </span>
            )}
          </div>

          {/* Title */}
          <h3 className="text-base font-medium">{idea.title}</h3>

          {/* Core Insight */}
          {idea.core_insight && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Core Insight</p>
              <p className="text-sm leading-relaxed">{idea.core_insight}</p>
            </div>
          )}

          {/* Full Context */}
          {idea.full_context && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Full Context</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{idea.full_context}</p>
            </div>
          )}

          {/* Why Post Worthy */}
          {idea.why_post_worthy && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Why Post-Worthy</p>
              <p className="text-sm leading-relaxed text-muted-foreground">{idea.why_post_worthy}</p>
            </div>
          )}

          {/* Key Points */}
          {idea.key_points && idea.key_points.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Key Points</p>
              <ul className="space-y-1">
                {idea.key_points.map((point, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Source Quote */}
          {idea.source_quote && (
            <div className="border-l-2 border-primary pl-3">
              <p className="text-sm italic text-muted-foreground">&ldquo;{idea.source_quote}&rdquo;</p>
            </div>
          )}

          {/* Hook */}
          {idea.hook && (
            <div className="border-l-2 border-primary pl-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Hook</p>
              <p className="text-sm italic">{idea.hook}</p>
            </div>
          )}

          {/* Score & Audience */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {idea.composite_score !== null && idea.composite_score !== undefined && (
              <span>Score: {idea.composite_score.toFixed(1)}</span>
            )}
            {idea.target_audience && (
              <span>Audience: {idea.target_audience}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            Close
          </button>
          {idea.status !== 'archived' && (
            <button
              onClick={() => onArchive(idea.id)}
              disabled={archiving}
              className="flex items-center justify-center gap-2 rounded-lg border border-border py-2 px-4 text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
            >
              {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Archive className="h-4 w-4" /> Archive</>}
            </button>
          )}
          {(idea.status === 'extracted' || idea.status === 'selected') && (
            <button
              onClick={() => onWritePost(idea.id)}
              disabled={writing}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {writing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Write Post'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

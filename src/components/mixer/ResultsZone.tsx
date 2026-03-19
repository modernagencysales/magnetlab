'use client';

/**
 * ResultsZone. Zone 4 — displays generated drafts or ideas after mixing.
 * Shows MixerBar + DraftResultCards (for drafts) or idea cards (for ideas).
 * Never imports from Next.js HTTP layer.
 */

import { Button } from '@magnetlab/magnetui';
import { Send, Pen } from 'lucide-react';
import { DraftResultCard } from './DraftResultCard';
import type { MixerResult, IngredientType } from '@/lib/types/mixer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SelectedIngredient {
  type: IngredientType;
  name: string;
  color: string;
}

interface ResultsZoneProps {
  result: MixerResult;
  ingredients: SelectedIngredient[];
  onEditRecipe: () => void;
  onRegenerate: () => void;
  onSendToQueue: (postContent: string) => void;
  onSendAll: () => void;
  authorName?: string;
  authorInitials?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ResultsZone({
  result,
  onSendToQueue,
  onSendAll,
  authorName = 'You',
  authorInitials = 'Y',
}: ResultsZoneProps) {
  // ─── Drafts view ──────────────────────────────────────
  if (result.type === 'drafts') {
    return (
      <div className="space-y-4 pt-2">
        {/* ─── Header row ──────────────────────────────── */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            {result.drafts.length} draft{result.drafts.length !== 1 ? 's' : ''} generated
          </h3>
          {result.drafts.length > 1 && (
            <Button size="sm" variant="outline" onClick={onSendAll}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Send all to queue
            </Button>
          )}
        </div>

        {/* ─── Draft cards ─────────────────────────────── */}
        <div className="space-y-3">
          {result.drafts.map((draft, i) => (
            <DraftResultCard
              key={i}
              draft={draft}
              authorName={authorName}
              authorInitials={authorInitials}
              onSendToQueue={onSendToQueue}
              onEdit={(content) => {
                // Open editor — for now copy to clipboard with a hint
                navigator.clipboard.writeText(content).catch(() => null);
              }}
              aiPick={draft.ai_pick}
            />
          ))}
        </div>
      </div>
    );
  }

  // ─── Ideas view ───────────────────────────────────────
  return (
    <div className="space-y-4 pt-2">
      {/* ─── Header row ───────────────────────────────── */}
      <h3 className="text-sm font-semibold text-foreground">
        {result.ideas.length} idea{result.ideas.length !== 1 ? 's' : ''} generated
      </h3>

      {/* ─── Idea cards ───────────────────────────────── */}
      <div className="space-y-2">
        {result.ideas.map((idea, i) => (
          <div
            key={i}
            className="flex items-start justify-between gap-3 p-3.5 rounded-lg border border-border bg-card"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground">{idea.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{idea.angle}</div>
              {idea.hook && (
                <div className="text-xs text-muted-foreground/70 mt-1 italic">
                  Hook: {idea.hook}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {idea.relevance_score > 0 && (
                <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                  {idea.relevance_score.toFixed(1)}
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // Write draft from idea — handled by parent page via toast for now
                  onSendToQueue(idea.hook || idea.title);
                }}
              >
                <Pen className="h-3 w-3 mr-1" />
                Write draft
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

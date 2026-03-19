'use client';

/**
 * CreativeCard. Single creative row in the Inspo queue.
 * Displays content preview, source info, score, and inline actions.
 */

import { Button, Badge } from '@magnetlab/magnetui';
import { Check, X, Zap } from 'lucide-react';
import { ScoreBadge } from './ScoreBadge';
import type { Creative } from '@/lib/types/exploits';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CreativeCardProps {
  creative: Creative;
  onApprove: (id: string) => void;
  onDismiss: (id: string) => void;
  onGenerate: (creative: Creative) => void;
}

// ─── Platform labels ──────────────────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, string> = {
  twitter: '🐦',
  reddit: '🔴',
  linkedin: '🔗',
  manual: '✏️',
  other: '📎',
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CreativeCard({ creative, onApprove, onDismiss, onGenerate }: CreativeCardProps) {
  return (
    <div className="flex gap-4 p-3.5 border border-border rounded-lg bg-card hover:bg-accent/50 transition-colors">
      <ScoreBadge score={creative.commentary_worthy_score} />

      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground line-clamp-2 leading-relaxed">
          {creative.content_text}
        </p>
        <div className="flex gap-2 mt-1.5 items-center">
          <Badge variant="gray" className="text-xs">
            {PLATFORM_ICONS[creative.source_platform] || '📎'} {creative.source_platform}
          </Badge>
          {creative.source_author && (
            <Badge variant="gray" className="text-xs">
              {creative.source_author}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">{timeAgo(creative.created_at)}</span>
        </div>
      </div>

      <div className="flex-shrink-0 flex gap-1.5 items-start">
        <Button
          variant="outline"
          size="sm"
          className="text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
          onClick={() => onApprove(creative.id)}
        >
          <Check className="h-3.5 w-3.5 mr-1" />
          Approve
        </Button>
        <Button variant="outline" size="sm" onClick={() => onDismiss(creative.id)}>
          <X className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
          onClick={() => onGenerate(creative)}
        >
          <Zap className="h-3.5 w-3.5 mr-1" />
          Generate
        </Button>
      </div>
    </div>
  );
}

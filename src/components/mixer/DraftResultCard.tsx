'use client';

/**
 * DraftResultCard. LinkedIn-style preview card for a generated draft.
 * Shows author avatar, content preview with see-more, and action buttons.
 * Never imports from Next.js HTTP layer.
 */

import { useState } from 'react';
import { Button, Badge } from '@magnetlab/magnetui';
import { Send, Copy, Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { MixerDraft } from '@/lib/types/mixer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DraftResultCardProps {
  draft: MixerDraft;
  authorName: string;
  authorInitials: string;
  onSendToQueue: (postContent: string) => void;
  onEdit: (postContent: string) => void;
  aiPick?: boolean;
}

const PREVIEW_CHAR_LIMIT = 280;

// ─── Component ────────────────────────────────────────────────────────────────

export function DraftResultCard({
  draft,
  authorName,
  authorInitials,
  onSendToQueue,
  onEdit,
  aiPick = false,
}: DraftResultCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const content = draft.content;
  const isTruncatable = content.length > PREVIEW_CHAR_LIMIT;
  const displayContent =
    expanded || !isTruncatable ? content : content.slice(0, PREVIEW_CHAR_LIMIT) + '…';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
      {/* ─── AI Pick badge ──────────────────────────────────── */}
      {aiPick && (
        <div className="absolute -top-2.5 left-4">
          <Badge variant="blue" className="text-[10px] font-bold px-2 py-0.5">
            AI Pick
          </Badge>
        </div>
      )}

      {/* ─── Author row ──────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-primary-foreground">{authorInitials}</span>
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground">{authorName}</div>
          <div className="text-xs text-muted-foreground">Just now · LinkedIn</div>
        </div>
      </div>

      {/* ─── Content ─────────────────────────────────────────── */}
      <div className="text-sm text-foreground whitespace-pre-line leading-relaxed">
        {displayContent}
        {isTruncatable && (
          <button
            type="button"
            className="ml-1 text-muted-foreground hover:text-foreground font-medium"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'see less' : 'see more'}
          </button>
        )}
      </div>

      {/* ─── Hook used ────────────────────────────────────────── */}
      {draft.hook_used && (
        <div className="text-xs text-muted-foreground border-t border-border pt-2">
          Hook: <span className="italic">{draft.hook_used}</span>
        </div>
      )}

      {/* ─── Actions ──────────────────────────────────────────── */}
      <div className="flex gap-2 pt-1">
        <Button size="sm" className="flex-1" onClick={() => onSendToQueue(content)}>
          <Send className="h-3.5 w-3.5 mr-1.5" />
          Send to Queue
        </Button>
        <Button variant="outline" size="sm" onClick={() => onEdit(content)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
}

'use client';

/**
 * SavedIdeasSection. Expandable section showing mixer-generated ideas below inventory.
 * Fetches count from the ideas API. Hidden when count is 0.
 * Never imports from Next.js HTTP layer.
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp, Pen } from 'lucide-react';
import { Badge, Button } from '@magnetlab/magnetui';
import useSWR from 'swr';
import { getIdeas } from '@/frontend/api/content-pipeline/ideas';
import type { ContentIdea } from '@/lib/types/content-pipeline';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavedIdeasSectionProps {
  teamProfileId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SavedIdeasSection({ teamProfileId }: SavedIdeasSectionProps) {
  const [expanded, setExpanded] = useState(false);

  // ─── Fetch ideas ────────────────────────────────────
  const { data: ideas, isLoading } = useSWR<ContentIdea[]>(
    teamProfileId ? ['ideas', teamProfileId, 'pending'] : null,
    () => getIdeas({ teamProfileId, status: 'pending', limit: 20 }),
    { revalidateOnFocus: false }
  );

  const count = ideas?.length ?? 0;

  // Hidden when loading or zero
  if (isLoading || count === 0) return null;

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* ─── Toggle header ─────────────────────────────── */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Saved Ideas</span>
          <Badge variant="gray" className="text-xs">
            {count}
          </Badge>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {/* ─── Expanded idea list ─────────────────────────── */}
      {expanded && (
        <div className="border-t border-border divide-y divide-border">
          {ideas?.map((idea) => (
            <div key={idea.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground line-clamp-1">{idea.title}</div>
                {idea.hook && (
                  <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1 italic">
                    {idea.hook}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="flex-shrink-0"
                onClick={() => {
                  // Handled by the content pipeline write-from-idea flow
                }}
              >
                <Pen className="h-3 w-3 mr-1" />
                Write
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

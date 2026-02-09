'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KnowledgeCategory } from '@/lib/types/content-pipeline';

const CATEGORY_STYLES: Record<KnowledgeCategory, { label: string; className: string }> = {
  insight: { label: 'Insight', className: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' },
  question: { label: 'Question', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' },
  product_intel: { label: 'Product Intel', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
};

interface KnowledgeEntryCardProps {
  entry: {
    id: string;
    category: KnowledgeCategory;
    content: string;
    context: string | null;
    tags: string[];
    similarity?: number;
  };
}

export function KnowledgeEntryCard({ entry }: KnowledgeEntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  const categoryConfig = CATEGORY_STYLES[entry.category] || CATEGORY_STYLES.insight;

  return (
    <div className="rounded-lg border bg-card p-4 transition-colors hover:border-primary/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            <span className={cn('rounded-full px-2 py-1 text-xs font-medium', categoryConfig.className)}>
              {categoryConfig.label}
            </span>
            {entry.similarity !== undefined && (
              <span className="text-xs text-muted-foreground">
                {Math.round(entry.similarity * 100)}% match
              </span>
            )}
          </div>
          <p className="text-sm leading-relaxed">{entry.content}</p>
        </div>
      </div>

      {/* Tags */}
      {entry.tags?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {entry.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Collapsible context */}
      {entry.context && (
        <div className="mt-3">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Context
          </button>
          {expanded && (
            <p className="mt-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground leading-relaxed">
              {entry.context}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

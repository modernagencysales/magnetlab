'use client';

import React, { useState } from 'react';
import { Brain, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@magnetlab/magnetui';

interface KnowledgeEntry {
  id?: string;
  content: string;
  knowledge_type?: string;
  quality_score?: number;
  topics?: string[];
  source_title?: string;
}

interface Props {
  data: KnowledgeEntry[] | { data?: KnowledgeEntry[] };
  onApply?: (type: string, data: unknown) => void;
}

const TYPE_COLORS: Record<string, string> = {
  how_to: 'bg-blue-100 text-blue-700',
  insight: 'bg-purple-100 text-purple-700',
  story: 'bg-green-100 text-green-700',
  question: 'bg-amber-100 text-amber-700',
  objection: 'bg-destructive/10 text-destructive',
  mistake: 'bg-orange-100 text-orange-700',
  decision: 'bg-cyan-100 text-cyan-700',
  market_intel: 'bg-emerald-100 text-emerald-700',
};

function QualityStars({ score }: { score: number }) {
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <Star
        key={i}
        className={`w-3 h-3 ${i <= score ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
      />
    );
  }
  return <div className="flex items-center gap-0.5">{stars}</div>;
}

export function KnowledgeResultCard({ data, onApply }: Props) {
  const entries: KnowledgeEntry[] = Array.isArray(data) ? data : data?.data || [];
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const maxShown = 10;
  const visibleEntries = entries.slice(0, maxShown);
  const moreCount = entries.length - maxShown;

  const toggleExpand = (index: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleUseInPost = (entry: KnowledgeEntry) => {
    onApply?.('knowledge_reference', { entryId: entry.id, content: entry.content });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 my-2">
      <div className="flex items-center gap-1.5 mb-2">
        <Brain className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs text-gray-500">Knowledge Results</span>
        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
          {entries.length}
        </span>
      </div>

      <div className="space-y-2">
        {visibleEntries.map((entry, index) => {
          const isExpanded = expandedIds.has(index);
          const isLong = entry.content.length > 100;
          const displayContent =
            isExpanded || !isLong ? entry.content : entry.content.slice(0, 100) + '...';
          const typeColor = TYPE_COLORS[entry.knowledge_type || ''] || 'bg-gray-100 text-gray-700';

          return (
            <div key={entry.id || index} className="border border-gray-100 rounded-md p-2">
              <div className="flex items-center gap-2 mb-1">
                {entry.knowledge_type && (
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${typeColor}`}
                  >
                    {entry.knowledge_type.replace(/_/g, ' ')}
                  </span>
                )}
                {entry.quality_score != null && <QualityStars score={entry.quality_score} />}
              </div>

              <button
                onClick={() => toggleExpand(index)}
                className="text-left w-full group"
                type="button"
              >
                <p className="text-xs text-gray-700 leading-relaxed">{displayContent}</p>
                {isLong && (
                  <span className="inline-flex items-center text-[10px] text-violet-500 mt-0.5">
                    {isExpanded ? (
                      <>
                        Show less <ChevronUp className="w-3 h-3 ml-0.5" />
                      </>
                    ) : (
                      <>
                        Show more <ChevronDown className="w-3 h-3 ml-0.5" />
                      </>
                    )}
                  </span>
                )}
              </button>

              {entry.source_title && (
                <p className="text-xs text-gray-400 mt-1">{entry.source_title}</p>
              )}

              {onApply && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleUseInPost(entry)}
                  className="mt-1.5 h-auto px-0 py-0 text-[10px] font-medium text-violet-600 hover:text-violet-700"
                >
                  Use in post
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {moreCount > 0 && <p className="text-xs text-gray-400 mt-2 text-center">+{moreCount} more</p>}
    </div>
  );
}

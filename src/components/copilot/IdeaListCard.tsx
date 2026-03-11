'use client';

import React from 'react';
import { Lightbulb, PenTool } from 'lucide-react';
import { Button } from '@magnetlab/magnetui';

interface Idea {
  id?: string;
  title: string;
  content_type?: string;
  hook?: string;
  core_insight?: string;
}

interface Props {
  data: Idea[] | { data?: Idea[] };
  onApply?: (type: string, data: unknown) => void;
}

const TYPE_COLORS: Record<string, string> = {
  thought_leadership: 'bg-violet-100 text-violet-700',
  personal_story: 'bg-green-100 text-green-700',
  how_to: 'bg-blue-100 text-blue-700',
  contrarian: 'bg-destructive/10 text-destructive',
  case_study: 'bg-amber-100 text-amber-700',
  listicle: 'bg-cyan-100 text-cyan-700',
  question: 'bg-purple-100 text-purple-700',
  announcement: 'bg-orange-100 text-orange-700',
};

export function IdeaListCard({ data, onApply }: Props) {
  const ideas: Idea[] = Array.isArray(data) ? data : data?.data || [];

  const handleWrite = (idea: Idea) => {
    onApply?.('write_from_idea', { idea });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Lightbulb className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Content Ideas</span>
        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
          {ideas.length}
        </span>
      </div>

      <div className="space-y-2">
        {ideas.map((idea, index) => {
          const typeColor = TYPE_COLORS[idea.content_type || ''] || 'bg-muted text-muted-foreground';

          return (
            <div key={idea.id || index} className="border border-border rounded-md p-2">
              <p className="text-sm font-medium text-foreground mb-1">{idea.title}</p>

              {idea.content_type && (
                <span
                  className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded-full mb-1 ${typeColor}`}
                >
                  {idea.content_type.replace(/_/g, ' ')}
                </span>
              )}

              {idea.hook && (
                <p className="text-xs text-muted-foreground italic">
                  {idea.hook.length > 80 ? idea.hook.slice(0, 80) + '...' : idea.hook}
                </p>
              )}

              {onApply && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleWrite(idea)}
                  className="mt-1.5 h-auto px-0 py-0 text-[10px] font-medium text-violet-600 hover:text-violet-700"
                >
                  <PenTool className="w-3 h-3 mr-1" />
                  Write this
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

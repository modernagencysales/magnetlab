'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, Star, BookOpen } from 'lucide-react';
import { TopicDetail } from './TopicDetail';

const KNOWLEDGE_TYPE_COLORS: Record<string, string> = {
  how_to: 'bg-blue-500',
  insight: 'bg-purple-500',
  story: 'bg-green-500',
  question: 'bg-yellow-500',
  objection: 'bg-red-500',
  mistake: 'bg-orange-500',
  decision: 'bg-indigo-500',
  market_intel: 'bg-teal-500',
};

interface Topic {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  entry_count: number;
  avg_quality: number | null;
  summary: string | null;
  summary_generated_at: string | null;
}

export function TopicBrowser({ teamId }: { teamId?: string }) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (teamId) params.append('team_id', teamId);
      const res = await fetch(`/api/content-pipeline/knowledge/topics?${params}`);
      const data = await res.json();
      setTopics(data.topics || []);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <p className="mt-4 text-muted-foreground">No topics discovered yet</p>
        <p className="mt-1 text-sm text-muted-foreground/70">Process transcripts to auto-discover topics</p>
      </div>
    );
  }

  if (selectedSlug) {
    return (
      <TopicDetail
        slug={selectedSlug}
        teamId={teamId}
        onBack={() => setSelectedSlug(null)}
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {topics.map((topic) => (
        <button
          key={topic.slug}
          onClick={() => setSelectedSlug(topic.slug)}
          className="rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/30"
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-sm">{topic.display_name}</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {topic.entry_count}
            </span>
          </div>

          {topic.description && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{topic.description}</p>
          )}

          {/* Quality stars */}
          {topic.avg_quality != null && topic.avg_quality > 0 && (
            <div className="mt-2 flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${
                    i <= Math.round(topic.avg_quality!)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-muted-foreground/30'
                  }`}
                />
              ))}
              <span className="ml-1 text-xs text-muted-foreground">
                {topic.avg_quality.toFixed(1)}
              </span>
            </div>
          )}

          {/* Summary badge */}
          {topic.summary && (
            <span className="mt-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              Has summary
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

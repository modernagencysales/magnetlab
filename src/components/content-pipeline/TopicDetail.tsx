'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { KnowledgeEntryCard } from './KnowledgeEntryCard';
import { KNOWLEDGE_TYPE_LABELS } from '@/lib/types/content-pipeline';
import type { KnowledgeCategory } from '@/lib/types/content-pipeline';

const KNOWLEDGE_TYPE_COLORS: Record<string, string> = {
  how_to: 'bg-blue-500', insight: 'bg-purple-500', story: 'bg-green-500',
  question: 'bg-yellow-500', objection: 'bg-red-500', mistake: 'bg-orange-500',
  decision: 'bg-indigo-500', market_intel: 'bg-teal-500',
};

interface TopicDetailData {
  topic: {
    id: string;
    slug: string;
    display_name: string;
    description: string | null;
    entry_count: number;
    avg_quality: number | null;
    summary: string | null;
    summary_generated_at: string | null;
    last_seen: string;
  };
  type_breakdown: Record<string, number>;
  top_entries: Record<string, Array<{
    id: string;
    category: KnowledgeCategory;
    content: string;
    context: string | null;
    tags: string[];
    knowledge_type?: string | null;
    quality_score?: number | null;
  }>>;
  corroboration_count: number;
}

interface TopicDetailProps {
  slug: string;
  teamId?: string;
  onBack: () => void;
}

export function TopicDetail({ slug, teamId, onBack }: TopicDetailProps) {
  const [data, setData] = useState<TopicDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (teamId) params.append('team_id', teamId);
      const res = await fetch(`/api/content-pipeline/knowledge/topics/${slug}?${params}`);
      const detail = await res.json();
      setData(detail);
      setSummary(detail.topic?.summary || null);
    } catch {
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [slug, teamId]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);

  const handleGenerateSummary = async (force: boolean = false) => {
    setGeneratingSummary(true);
    try {
      const params = force ? '?force=true' : '';
      const res = await fetch(`/api/content-pipeline/knowledge/topics/${slug}/summary${params}`, {
        method: 'POST',
      });
      const result = await res.json();
      if (result.summary) {
        setSummary(result.summary);
      }
    } catch {
      // Silent
    } finally {
      setGeneratingSummary(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button onClick={() => fetchDetail()} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90">Retry</button>
      </div>
    );
  }

  if (!data?.topic) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Topic not found</p>
        <button onClick={onBack} className="mt-2 text-sm text-primary hover:underline">Back to topics</button>
      </div>
    );
  }

  const { topic, type_breakdown, top_entries, corroboration_count } = data;

  // Check if summary is stale
  const isSummaryStale = topic.summary_generated_at && topic.last_seen
    ? new Date(topic.last_seen) > new Date(topic.summary_generated_at)
    : false;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={onBack}
          className="mb-4 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to topics
        </button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{topic.display_name}</h2>
            {topic.description && (
              <p className="mt-1 text-sm text-muted-foreground">{topic.description}</p>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              <span>{topic.entry_count} entries</span>
              {topic.avg_quality && <span>Avg quality: {topic.avg_quality.toFixed(1)}/5</span>}
              {corroboration_count > 0 && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 dark:bg-green-950 dark:text-green-300">
                  {corroboration_count} corroborations
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary panel */}
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">Topic Summary</h3>
          <div className="flex items-center gap-2">
            {isSummaryStale && summary && (
              <span className="text-xs text-yellow-600 dark:text-yellow-400">Stale — new entries available</span>
            )}
            {summary ? (
              <button
                onClick={() => handleGenerateSummary(true)}
                disabled={generatingSummary}
                className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors"
              >
                {generatingSummary ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Regenerate
              </button>
            ) : (
              <button
                onClick={() => handleGenerateSummary(false)}
                disabled={generatingSummary}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {generatingSummary ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Generate Summary
              </button>
            )}
          </div>
        </div>
        {summary ? (
          <p className="text-sm leading-relaxed">{summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No summary generated yet. Click &quot;Generate Summary&quot; to create one.</p>
        )}
      </div>

      {/* Type breakdown bar */}
      {Object.keys(type_breakdown).length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Knowledge Types</h3>
          <div className="flex h-3 rounded-full overflow-hidden">
            {Object.entries(type_breakdown).map(([type, count]) => {
              const total = Object.values(type_breakdown).reduce((s, c) => s + c, 0);
              const pct = (count / total) * 100;
              return (
                <div
                  key={type}
                  className={`${KNOWLEDGE_TYPE_COLORS[type] || 'bg-gray-400'}`}
                  style={{ width: `${pct}%` }}
                  title={`${KNOWLEDGE_TYPE_LABELS[type] || type}: ${count}`}
                />
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {Object.entries(type_breakdown).map(([type, count]) => (
              <span key={type} className="flex items-center gap-1">
                <span className={`inline-block h-2 w-2 rounded-full ${KNOWLEDGE_TYPE_COLORS[type] || 'bg-gray-400'}`} />
                {KNOWLEDGE_TYPE_LABELS[type] || type} ({count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Entries by type */}
      {Object.entries(top_entries).map(([type, typeEntries]) => (
        <div key={type}>
          <h3 className="mb-3 text-sm font-semibold">{KNOWLEDGE_TYPE_LABELS[type] || type}</h3>
          <div className="space-y-3">
            {typeEntries.map((entry) => (
              <KnowledgeEntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

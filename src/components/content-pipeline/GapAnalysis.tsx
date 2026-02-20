'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertTriangle, CheckCircle2, XCircle, BarChart } from 'lucide-react';
import { cn } from '@/lib/utils';

const KNOWLEDGE_TYPE_LABELS: Record<string, string> = {
  how_to: 'How-To',
  insight: 'Insights',
  story: 'Stories',
  question: 'Questions',
  objection: 'Objections',
  mistake: 'Mistakes',
  decision: 'Decisions',
  market_intel: 'Market Intel',
};

const GOALS = [
  { value: 'lead_magnet', label: 'Lead Magnet' },
  { value: 'blog_post', label: 'Blog Post' },
  { value: 'course', label: 'Course' },
  { value: 'sop', label: 'SOP' },
  { value: 'content_week', label: 'Content Week' },
];

interface GapData {
  topic_slug: string;
  topic_name: string;
  coverage_score: number;
  missing_types: string[];
  gap_patterns: string[];
  entry_count: number;
  avg_quality: number | null;
}

interface ReadinessResult {
  ready: boolean;
  confidence: number;
  reasoning: string;
  gaps_that_would_improve: string[];
}

export function GapAnalysis({ teamId }: { teamId?: string }) {
  const [gaps, setGaps] = useState<GapData[]>([]);
  const [loading, setLoading] = useState(true);

  // Readiness state
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedGoal, setSelectedGoal] = useState('lead_magnet');
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [assessing, setAssessing] = useState(false);

  const fetchGaps = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '20' });
      if (teamId) params.append('team_id', teamId);
      const res = await fetch(`/api/content-pipeline/knowledge/gaps?${params}`);
      const data = await res.json();
      setGaps(data.gaps || []);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => { fetchGaps(); }, [fetchGaps]);

  const handleAssessReadiness = async () => {
    if (!selectedTopic) return;
    setAssessing(true);
    setReadiness(null);
    try {
      const params = new URLSearchParams({ topic: selectedTopic, goal: selectedGoal });
      const res = await fetch(`/api/content-pipeline/knowledge/readiness?${params}`);
      const data = await res.json();
      setReadiness(data.readiness || null);
    } catch {
      // Silent
    } finally {
      setAssessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (gaps.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <p className="mt-4 text-muted-foreground">No topics to analyze</p>
        <p className="mt-1 text-sm text-muted-foreground/70">Process transcripts to discover topics and analyze gaps</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Readiness Assessment Panel */}
      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Content Readiness Assessment</h3>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Topic</label>
            <select
              value={selectedTopic}
              onChange={(e) => { setSelectedTopic(e.target.value); setReadiness(null); }}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              <option value="">Select a topic...</option>
              {gaps.map((g) => (
                <option key={g.topic_slug} value={g.topic_name}>{g.topic_name}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[160px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Goal</label>
            <select
              value={selectedGoal}
              onChange={(e) => { setSelectedGoal(e.target.value); setReadiness(null); }}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            >
              {GOALS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAssessReadiness}
            disabled={!selectedTopic || assessing}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {assessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assess'}
          </button>
        </div>

        {readiness && (
          <div className="mt-4 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              {readiness.ready ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className={cn('font-semibold text-sm', readiness.ready ? 'text-green-600' : 'text-red-600')}>
                {readiness.ready ? 'Ready' : 'Not Ready'}
              </span>
              <span className="text-xs text-muted-foreground">
                ({Math.round(readiness.confidence * 100)}% confidence)
              </span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{readiness.reasoning}</p>
            {readiness.gaps_that_would_improve.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">To improve:</p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5">
                  {readiness.gaps_that_would_improve.map((gap, i) => (
                    <li key={i}>{gap}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Gap Cards */}
      <div>
        <h3 className="mb-4 text-sm font-semibold uppercase text-muted-foreground">Knowledge Gaps by Topic</h3>
        <div className="space-y-4">
          {gaps.map((gap) => {
            const scoreColor = gap.coverage_score < 0.3 ? 'bg-red-500' : gap.coverage_score < 0.6 ? 'bg-yellow-500' : 'bg-green-500';
            return (
              <div key={gap.topic_slug} className="rounded-lg border bg-card p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h4 className="font-medium text-sm">{gap.topic_name}</h4>
                    <p className="text-xs text-muted-foreground">{gap.entry_count} entries</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {Math.round(gap.coverage_score * 100)}% coverage
                  </span>
                </div>

                {/* Coverage bar */}
                <div className="mb-3 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', scoreColor)}
                    style={{ width: `${gap.coverage_score * 100}%` }}
                  />
                </div>

                {/* Missing types */}
                {gap.missing_types.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Missing:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {gap.missing_types.map((type) => (
                        <span key={type} className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                          {KNOWLEDGE_TYPE_LABELS[type] || type}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gap patterns */}
                {gap.gap_patterns.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {gap.gap_patterns.map((pattern, i) => (
                      <p key={i} className="text-xs text-muted-foreground italic">{pattern}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

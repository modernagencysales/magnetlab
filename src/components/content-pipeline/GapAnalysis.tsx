'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertTriangle, CheckCircle2, XCircle, BarChart } from 'lucide-react';
import {
  Button,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Badge,
} from '@magnetlab/magnetui';
import { cn } from '@/lib/utils';
import { KNOWLEDGE_TYPE_LABELS } from '@/lib/types/content-pipeline';
import * as knowledgeApi from '@/frontend/api/content-pipeline/knowledge';

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
  const [error, setError] = useState<string | null>(null);

  // Readiness state
  const [selectedTopic, setSelectedTopic] = useState('');
  const [selectedGoal, setSelectedGoal] = useState('lead_magnet');
  const [readiness, setReadiness] = useState<ReadinessResult | null>(null);
  const [assessing, setAssessing] = useState(false);

  const fetchGaps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await knowledgeApi.getKnowledgeGaps({ limit: 20, team_id: teamId })) as {
        gaps?: GapData[];
      };
      setGaps(data.gaps || []);
    } catch {
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchGaps();
  }, [fetchGaps]);

  const handleAssessReadiness = async () => {
    if (!selectedTopic) return;
    setAssessing(true);
    setReadiness(null);
    try {
      const data = (await knowledgeApi.getKnowledgeReadiness({
        topic: selectedTopic,
        goal: selectedGoal,
        team_id: teamId,
      })) as { readiness?: ReadinessResult };
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

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button onClick={() => fetchGaps()}>Retry</Button>
      </div>
    );
  }

  if (gaps.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground/50" />
        <p className="mt-4 text-muted-foreground">No topics to analyze</p>
        <p className="mt-1 text-sm text-muted-foreground/70">
          Process transcripts to discover topics and analyze gaps
        </p>
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
            <Label className="mb-1 block text-xs font-medium text-muted-foreground">Topic</Label>
            <Select
              value={selectedTopic}
              onValueChange={(value) => {
                setSelectedTopic(value);
                setReadiness(null);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a topic..." />
              </SelectTrigger>
              <SelectContent>
                {gaps.map((g) => (
                  <SelectItem key={g.topic_slug} value={g.topic_name}>
                    {g.topic_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <Label className="mb-1 block text-xs font-medium text-muted-foreground">Goal</Label>
            <Select
              value={selectedGoal}
              onValueChange={(value) => {
                setSelectedGoal(value);
                setReadiness(null);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GOALS.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAssessReadiness} disabled={!selectedTopic || assessing}>
            {assessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assess'}
          </Button>
        </div>

        {readiness && (
          <div className="mt-4 rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              {readiness.ready ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span
                className={cn(
                  'font-semibold text-sm',
                  readiness.ready ? 'text-green-600' : 'text-red-600'
                )}
              >
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
        <h3 className="mb-4 text-sm font-semibold uppercase text-muted-foreground">
          Knowledge Gaps by Topic
        </h3>
        <div className="space-y-4">
          {gaps.map((gap) => {
            const scoreColor =
              gap.coverage_score < 0.3
                ? 'bg-red-500'
                : gap.coverage_score < 0.6
                  ? 'bg-yellow-500'
                  : 'bg-green-500';
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
                        <Badge key={type} variant="red">
                          {KNOWLEDGE_TYPE_LABELS[type] || type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Gap patterns */}
                {gap.gap_patterns.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {gap.gap_patterns.map((pattern, i) => (
                      <p key={i} className="text-xs text-muted-foreground italic">
                        {pattern}
                      </p>
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

'use client';

import { useState } from 'react';
import { Loader2, Sparkles, Zap } from 'lucide-react';
import { Button } from '@magnetlab/magnetui';
import { cn } from '@/lib/utils';

interface HookScoreData {
  score: number;
  breakdown: {
    curiosity_gap: number;
    power_words: number;
    pattern_interrupt: number;
    specificity: number;
  };
  suggestions: string[];
}

interface HookScorePanelProps {
  postId: string;
  initialScore: number | null;
  onVariantsGenerated: () => void;
}

const BREAKDOWN_LABELS: { key: keyof HookScoreData['breakdown']; label: string }[] = [
  { key: 'curiosity_gap', label: 'Curiosity Gap' },
  { key: 'power_words', label: 'Power Words' },
  { key: 'pattern_interrupt', label: 'Pattern Interrupt' },
  { key: 'specificity', label: 'Specificity' },
];

function scoreColor(score: number): string {
  if (score >= 8) return 'text-green-500';
  if (score >= 5) return 'text-amber-500';
  return 'text-destructive';
}

function barColor(score: number): string {
  if (score >= 8) return 'bg-green-500';
  if (score >= 5) return 'bg-amber-500';
  return 'bg-destructive';
}

function scoreBgRing(score: number): string {
  if (score >= 8) return 'border-green-500/30';
  if (score >= 5) return 'border-amber-500/30';
  return 'border-destructive/30';
}

export function HookScorePanel({ postId, initialScore, onVariantsGenerated }: HookScorePanelProps) {
  const [scoreData, setScoreData] = useState<HookScoreData | null>(null);
  const [scoring, setScoring] = useState(false);
  const [generating, setGenerating] = useState(false);

  const displayScore = scoreData?.score ?? initialScore;

  const handleScore = async () => {
    setScoring(true);
    try {
      const response = await fetch(`/api/content-pipeline/posts/${postId}/hook-score`, {
        method: 'POST',
      });
      if (response.ok) {
        const data: HookScoreData = await response.json();
        setScoreData(data);
      }
    } catch {
      // Silent
    } finally {
      setScoring(false);
    }
  };

  const handleGenerateVariants = async () => {
    setGenerating(true);
    try {
      const response = await fetch(`/api/content-pipeline/posts/${postId}/hook-variants`, {
        method: 'POST',
      });
      if (response.ok) {
        onVariantsGenerated();
      }
    } catch {
      // Silent
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-xs font-semibold">Hook Analysis</span>
        </div>
        <Button size="sm" onClick={handleScore} disabled={scoring}>
          {scoring ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          {scoreData || initialScore !== null ? 'Re-score' : 'Score Hook'}
        </Button>
      </div>

      {/* Score circle */}
      {displayScore !== null && displayScore !== undefined && (
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full border-2',
              scoreBgRing(displayScore)
            )}
          >
            <span className={cn('text-lg font-bold', scoreColor(displayScore))}>
              {displayScore}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">/10</span>
        </div>
      )}

      {/* Breakdown bars */}
      {scoreData?.breakdown && (
        <div className="space-y-1.5">
          {BREAKDOWN_LABELS.map(({ key, label }) => {
            const value = scoreData.breakdown[key];
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="w-28 truncate text-[11px] text-muted-foreground">{label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full transition-all', barColor(value))}
                    style={{ width: `${(value / 10) * 100}%` }}
                  />
                </div>
                <span className={cn('w-6 text-right text-[11px] font-medium', scoreColor(value))}>
                  {value}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Suggestions */}
      {scoreData?.suggestions && scoreData.suggestions.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Suggestions</span>
          {scoreData.suggestions.map((suggestion, i) => (
            <p key={i} className="border-l-2 border-primary/20 pl-2 text-xs text-muted-foreground">
              {suggestion}
            </p>
          ))}
        </div>
      )}

      {/* Generate variants button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full border-dashed"
        onClick={handleGenerateVariants}
        disabled={generating}
      >
        {generating ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        Generate 3 Hook Variants
      </Button>
    </div>
  );
}

'use client';

/**
 * ScoreBadge. Color-coded commentary-worthy score badge.
 * Green 7+, yellow 4-6, red 0-3.
 */

import { cn } from '@/lib/utils';

interface ScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md';
}

const SCORE_STYLES = {
  high: 'bg-emerald-500/10 text-emerald-500',
  medium: 'bg-yellow-500/10 text-yellow-500',
  low: 'bg-red-500/10 text-red-500',
} as const;

function getScoreLevel(score: number): keyof typeof SCORE_STYLES {
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

export function ScoreBadge({ score, size = 'md' }: ScoreBadgeProps) {
  const level = getScoreLevel(score);
  return (
    <div
      className={cn(
        'flex-shrink-0 flex items-center justify-center rounded-lg font-bold',
        SCORE_STYLES[level],
        size === 'md' ? 'h-9 w-9 text-sm' : 'h-6 w-6 text-xs'
      )}
    >
      {Math.round(score)}
    </div>
  );
}

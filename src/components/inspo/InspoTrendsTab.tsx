'use client';

/**
 * InspoTrendsTab. Shows trending topics detected by the scanner.
 * 3-column card grid, read-only.
 */

import { TrendingUp, Minus, TrendingDown } from 'lucide-react';
import { Badge } from '@magnetlab/magnetui';
import { cn } from '@/lib/utils';
import { useTrends } from '@/frontend/hooks/api/useTrends';

const TREND_CONFIG = {
  rising: { icon: TrendingUp, color: 'text-emerald-500', label: 'Rising' },
  stable: { icon: Minus, color: 'text-yellow-500', label: 'Stable' },
  declining: { icon: TrendingDown, color: 'text-muted-foreground', label: 'Declining' },
} as const;

export function InspoTrendsTab() {
  const { topics, isLoading } = useTrends();

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No trending topics detected yet.</p>
        <p className="text-sm mt-1">Configure scanner sources to start tracking trends.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {topics.map((topic) => {
        const config = TREND_CONFIG[topic.trend];
        const Icon = config.icon;

        return (
          <div key={topic.topic} className="p-3.5 bg-card border border-border rounded-lg">
            <h4 className="text-sm font-medium text-foreground">{topic.topic}</h4>
            <div className="flex items-center gap-1.5 mt-1.5">
              <Icon className={cn('h-5 w-5', config.color)} />
              <span className={cn('text-lg font-bold', config.color)}>{config.label}</span>
            </div>
            <div className="flex gap-2 mt-2">
              <Badge variant="gray" className="text-xs">
                {topic.count} mentions
              </Badge>
              <Badge variant="gray" className="text-xs">
                {(topic.confidence * 100).toFixed(0)}% confidence
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** StatsCards. Compact metric grid for the copilot homepage. Constraint: Client-only, no data fetching. */

'use client';

import type { StatCard } from '@/frontend/hooks/api/useHomepageData';

// ─── Props ────────────────────────────────────────────────

interface StatsCardsProps {
  stats: StatCard[];
}

// ─── Helpers ──────────────────────────────────────────────

function changeClass(changeType: StatCard['changeType']): string {
  if (changeType === 'positive') return 'text-green-500';
  if (changeType === 'negative') return 'text-red-500';
  return 'text-muted-foreground';
}

// ─── Component ────────────────────────────────────────────

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto">
      {stats.map((stat) => (
        <div key={stat.key} className="bg-card border border-border rounded-lg p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {stat.label}
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">{stat.value}</div>
          {stat.sublabel ? (
            <div className="text-xs mt-1 text-muted-foreground">{stat.sublabel}</div>
          ) : stat.change ? (
            <div className={`text-xs mt-1 ${changeClass(stat.changeType)}`}>
              {stat.change}
              {stat.period ? ` ${stat.period}` : ''}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

'use client';

/**
 * StartFromHere. Curated feed of actionable starting points from the user's ingredient collection.
 * Fetches knowledge topics, exploits, creatives, and trends, mixes them into a single ranked feed.
 * Each card is one click away from pre-filling the mixer.
 * Never imports from Next.js HTTP layer.
 */

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { getTopics } from '@/frontend/api/content-pipeline/knowledge';
import { getExploits } from '@/frontend/api/content-pipeline/exploits';
import { getCreatives } from '@/frontend/api/content-pipeline/creatives';
import { getTrends } from '@/frontend/api/content-pipeline/trends';
import { getInventory } from '@/frontend/api/content-pipeline/mixer';
import { INGREDIENT_META } from './ingredientMeta';
import type { IngredientType } from '@/lib/types/mixer';
import type { KnowledgeTopic } from '@/lib/types/content-pipeline';
import type { ExploitWithStats, Creative } from '@/lib/types/exploits';
import type { TrendingTopic } from '@/frontend/api/content-pipeline/trends';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StartFromHereProps {
  teamProfileId: string;
  onSelectIngredient: (type: IngredientType, item: { id: string; name: string }) => void;
}

interface FeedCard {
  key: string;
  type: IngredientType;
  id: string;
  name: string;
  description: string;
  /** Left border color class (design-token-safe via opacity variants) */
  borderColorClass: string;
}

// ─── Inventory summary types ───────────────────────────────────────────────────

interface InventorySummary {
  knowledge: number;
  exploits: number;
  styles: number;
  templates: number;
  creatives: number;
  trends?: number;
  recycled?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_BORDER_COLORS: Record<IngredientType, string> = {
  knowledge: 'border-l-violet-500',
  exploits: 'border-l-orange-500',
  styles: 'border-l-blue-500',
  templates: 'border-l-teal-500',
  creatives: 'border-l-yellow-500',
  trends: 'border-l-pink-500',
  recycled: 'border-l-emerald-500',
};

function topicToCard(topic: KnowledgeTopic): FeedCard {
  const count = topic.entry_count ?? 0;
  const entryWord = count === 1 ? 'entry' : 'entries';
  return {
    key: `knowledge-${topic.id}`,
    type: 'knowledge',
    id: topic.slug || topic.id,
    name: topic.display_name || topic.slug || 'Unknown topic',
    description: `${count} ${entryWord} in your knowledge base`,
    borderColorClass: TYPE_BORDER_COLORS.knowledge,
  };
}

function exploitToCard(exploit: ExploitWithStats): FeedCard {
  const multiplierText =
    exploit.performance_multiplier != null
      ? `${exploit.performance_multiplier.toFixed(1)}x engagement`
      : 'Authority Play';
  const label = `${exploit.category === 'lead_magnet' ? 'Lead Magnet' : 'Authority'} Play · ${multiplierText}`;
  return {
    key: `exploits-${exploit.id}`,
    type: 'exploits',
    id: exploit.id,
    name: exploit.name,
    description: label,
    borderColorClass: TYPE_BORDER_COLORS.exploits,
  };
}

function creativeToCard(creative: Creative): FeedCard {
  const maxLen = 80;
  const text =
    creative.content_text.length > maxLen
      ? `${creative.content_text.slice(0, maxLen).trimEnd()}…`
      : creative.content_text;
  const platform =
    creative.source_platform.charAt(0).toUpperCase() + creative.source_platform.slice(1);
  return {
    key: `creatives-${creative.id}`,
    type: 'creatives',
    id: creative.id,
    name: text,
    description: `${platform} · approved, unused`,
    borderColorClass: TYPE_BORDER_COLORS.creatives,
  };
}

function trendToCard(trend: TrendingTopic): FeedCard {
  const trendLabel = trend.trend === 'rising' ? 'rising' : trend.trend;
  return {
    key: `trends-${trend.topic}`,
    type: 'trends',
    id: trend.topic,
    name: trend.topic,
    description: `${trend.count} mention${trend.count !== 1 ? 's' : ''} · ${trendLabel}`,
    borderColorClass: TYPE_BORDER_COLORS.trends,
  };
}

/** Interleave cards from different sources so the feed feels mixed, not siloed. */
function buildFeed(
  topics: KnowledgeTopic[],
  exploits: ExploitWithStats[],
  creatives: Creative[],
  trends: TrendingTopic[]
): FeedCard[] {
  const topicCards = topics.slice(0, 3).map(topicToCard);
  const exploitCards = exploits.slice(0, 3).map(exploitToCard);
  const creativeCards = creatives.slice(0, 2).map(creativeToCard);
  const trendCards = trends
    .filter((t) => t.trend === 'rising')
    .slice(0, 2)
    .map(trendToCard);

  // Interleave: exploit, knowledge, trend, creative, exploit, knowledge, creative, ...
  const interleaved: FeedCard[] = [];
  const buckets = [exploitCards, topicCards, trendCards, creativeCards];
  let i = 0;
  while (interleaved.length < 10) {
    let added = false;
    for (const bucket of buckets) {
      if (bucket[i] !== undefined) {
        interleaved.push(bucket[i]!);
        added = true;
        if (interleaved.length >= 10) break;
      }
    }
    i++;
    if (!added) break;
  }

  return interleaved;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StartFromHere({ teamProfileId, onSelectIngredient }: StartFromHereProps) {
  const [cards, setCards] = useState<FeedCard[]>([]);
  const [summary, setSummary] = useState<InventorySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [topicsRes, exploits, creatives, trends, inventory] = await Promise.allSettled([
        getTopics({ limit: 6 }),
        getExploits({ with_stats: true }),
        getCreatives({ status: 'approved', limit: 5 }),
        getTrends(8),
        getInventory(teamProfileId),
      ]);

      const topics =
        topicsRes.status === 'fulfilled'
          ? ((topicsRes.value.topics ?? []) as KnowledgeTopic[])
          : [];
      const exploitList = exploits.status === 'fulfilled' ? exploits.value : [];
      const creativeList = creatives.status === 'fulfilled' ? creatives.value : [];
      const trendList = trends.status === 'fulfilled' ? trends.value : [];

      setCards(buildFeed(topics, exploitList, creativeList, trendList));

      if (inventory.status === 'fulfilled') {
        const inv = inventory.value;
        const countMap = new Map((inv.ingredients ?? []).map((ing) => [ing.type, ing.count]));
        setSummary({
          knowledge: countMap.get('knowledge') ?? 0,
          exploits: countMap.get('exploits') ?? 0,
          styles: countMap.get('styles') ?? 0,
          templates: countMap.get('templates') ?? 0,
          creatives: countMap.get('creatives') ?? 0,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [teamProfileId]);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Loading skeleton ─────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-4 w-32 bg-muted/50 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-lg bg-muted/40 animate-pulse border-l-4 border-l-muted/60"
            />
          ))}
        </div>
        <div className="h-3 w-64 bg-muted/30 rounded animate-pulse" />
      </div>
    );
  }

  // ─── Empty state ──────────────────────────────────────────────────────────

  if (cards.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Start From Here
        </h3>
        <p className="text-sm text-muted-foreground py-4 text-center">
          Add some knowledge, exploits, or creatives to see suggestions here.
        </p>
      </div>
    );
  }

  // ─── Feed ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">
      {/* ─── Section header ──────────────────────────────── */}
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Start From Here
      </h3>

      {/* ─── Card grid ───────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((card) => {
          const meta = INGREDIENT_META[card.type];
          const Icon = meta.lucideIcon;

          return (
            <button
              key={card.key}
              type="button"
              onClick={() => onSelectIngredient(card.type, { id: card.id, name: card.name })}
              className={cn(
                'flex flex-col gap-1.5 p-3 rounded-lg text-left',
                'border border-border border-l-4',
                card.borderColorClass,
                'bg-card hover:bg-accent/40 transition-colors'
              )}
            >
              {/* Type badge */}
              <div className="flex items-center gap-1.5">
                <Icon className={cn('h-3 w-3 shrink-0', meta.accentClass)} />
                <span
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-wide',
                    meta.accentClass
                  )}
                >
                  {meta.label}
                </span>
              </div>

              {/* Name */}
              <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">
                {card.name}
              </p>

              {/* Context */}
              <p className="text-xs text-muted-foreground leading-snug line-clamp-1">
                {card.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* ─── Inventory summary line ───────────────────────── */}
      {summary && (
        <p className="text-xs text-muted-foreground/70 pt-0.5">
          {summary.knowledge} knowledge &middot; {summary.exploits} exploits &middot;{' '}
          {summary.styles} styles &middot; {summary.templates} templates &middot;{' '}
          {summary.creatives} creatives
        </p>
      )}
    </div>
  );
}

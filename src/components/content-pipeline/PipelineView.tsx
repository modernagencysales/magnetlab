'use client';

import { useState, useEffect, useCallback } from 'react';
import { Lightbulb, PenLine, CalendarCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KanbanBoard } from './KanbanBoard';
import type { ContentIdea, PipelinePost } from '@/lib/types/content-pipeline';

interface PipelineViewProps {
  profileId?: string | null;
  onRefresh?: () => void;
}

interface HeroStats {
  readyToWrite: number;
  inProgress: number;
  reviewingCount: number;
  scheduled: number;
}

export function PipelineView({ profileId, onRefresh }: PipelineViewProps) {
  const [stats, setStats] = useState<HeroStats>({
    readyToWrite: 0,
    inProgress: 0,
    reviewingCount: 0,
    scheduled: 0,
  });

  const fetchStats = useCallback(async () => {
    try {
      const profileParam = profileId ? `&profile_id=${profileId}` : '';
      const [ideasRes, postsRes] = await Promise.all([
        fetch(`/api/content-pipeline/ideas?status=extracted&limit=200${profileParam}`),
        fetch(`/api/content-pipeline/posts?limit=200${profileParam}`),
      ]);
      const [ideasData, postsData] = await Promise.all([
        ideasRes.json(),
        postsRes.json(),
      ]);

      const ideas: ContentIdea[] = ideasData.ideas || [];
      const posts: PipelinePost[] = postsData.posts || [];

      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const draftOrReviewing = posts.filter(
        (p) => p.status === 'draft' || p.status === 'reviewing'
      );
      const reviewing = draftOrReviewing.filter((p) => p.status === 'reviewing');
      const scheduledSoon = posts.filter(
        (p) =>
          p.status === 'scheduled' &&
          p.scheduled_time &&
          new Date(p.scheduled_time) <= sevenDaysFromNow
      );

      setStats({
        readyToWrite: ideas.length,
        inProgress: draftOrReviewing.length,
        reviewingCount: reviewing.length,
        scheduled: scheduledSoon.length,
      });
    } catch {
      // Stats are supplementary — silent failure is fine
    }
  }, [profileId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleRefresh = useCallback(() => {
    fetchStats();
    onRefresh?.();
  }, [fetchStats, onRefresh]);

  const cards = [
    {
      label: 'Ready to Write',
      value: stats.readyToWrite,
      icon: Lightbulb,
      iconColor: 'text-purple-500',
      bgColor: 'bg-purple-50 dark:bg-purple-950/30',
    },
    {
      label: 'In Progress',
      value: stats.inProgress,
      subtext: stats.reviewingCount > 0 ? `${stats.reviewingCount} need review` : undefined,
      icon: PenLine,
      iconColor: 'text-blue-500',
      bgColor: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      label: 'Scheduled',
      value: stats.scheduled,
      subtext: 'next 7 days',
      icon: CalendarCheck,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className={cn(
              'rounded-xl border p-4 transition-colors',
              card.bgColor
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn('rounded-lg bg-background p-2 shadow-sm')}>
                <card.icon className={cn('h-5 w-5', card.iconColor)} />
              </div>
              <div>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                {card.subtext && (
                  <p className="text-[10px] text-muted-foreground/70">{card.subtext}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Kanban board */}
      <KanbanBoard onRefresh={handleRefresh} />
    </div>
  );
}

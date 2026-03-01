'use client';

import { useMemo, useCallback } from 'react';
import { Lightbulb, PenLine, CalendarCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { KanbanBoard } from './KanbanBoard';
import type { ContentIdea, PipelinePost } from '@/lib/types/content-pipeline';

interface PipelineViewProps {
  profileId?: string | null;
  onRefresh?: () => void;
  initialIdeas: ContentIdea[];
  initialPosts: PipelinePost[];
}

interface HeroStats {
  readyToWrite: number;
  inProgress: number;
  reviewingCount: number;
  scheduled: number;
}

function computeStats(
  ideas: ContentIdea[],
  posts: PipelinePost[],
  profileId?: string | null
): HeroStats {
  const filteredIdeas = profileId
    ? ideas.filter((i) => i.team_profile_id === profileId)
    : ideas;
  const filteredPosts = profileId
    ? posts.filter((p) => p.team_profile_id === profileId)
    : posts;
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const draftOrReviewing = filteredPosts.filter(
    (p) => p.status === 'draft' || p.status === 'reviewing'
  );
  const reviewing = draftOrReviewing.filter((p) => p.status === 'reviewing');
  const scheduledSoon = filteredPosts.filter(
    (p) =>
      p.status === 'scheduled' &&
      p.scheduled_time &&
      new Date(p.scheduled_time) <= sevenDaysFromNow
  );
  return {
    readyToWrite: filteredIdeas.length,
    inProgress: draftOrReviewing.length,
    reviewingCount: reviewing.length,
    scheduled: scheduledSoon.length,
  };
}

export function PipelineView({
  profileId,
  onRefresh,
  initialIdeas,
  initialPosts,
}: PipelineViewProps) {
  const stats = useMemo(
    () => computeStats(initialIdeas, initialPosts, profileId),
    [initialIdeas, initialPosts, profileId]
  );

  const handleRefresh = useCallback(() => {
    onRefresh?.();
  }, [onRefresh]);

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
      <KanbanBoard
        onRefresh={handleRefresh}
        profileId={profileId}
        initialIdeas={initialIdeas}
        initialPosts={initialPosts}
      />
    </div>
  );
}

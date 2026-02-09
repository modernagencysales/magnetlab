'use client';

import { addDays, format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { WeekPlan, ContentPillar } from '@/lib/types/content-pipeline';
import { CONTENT_PILLAR_LABELS } from '@/lib/types/content-pipeline';

interface WeekGridProps {
  plan: WeekPlan;
  weekStart: Date;
}

const PILLAR_COLORS: Record<ContentPillar, string> = {
  moments_that_matter: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  teaching_promotion: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300',
  human_personal: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  collaboration_social_proof: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
};

export function WeekGrid({ plan, weekStart }: WeekGridProps) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day, dayIndex) => {
        const dayPosts = (plan.planned_posts || []).filter(
          (p) => p.day === dayIndex // 0=Mon, 6=Sun
        );

        return (
          <div key={dayIndex} className="rounded-lg bg-muted/50 p-2">
            <div className="mb-2 text-center">
              <p className="text-xs font-semibold">{format(day, 'EEE')}</p>
              <p className="text-[10px] text-muted-foreground">{format(day, 'MMM d')}</p>
            </div>
            <div className="space-y-1.5">
              {dayPosts.length === 0 ? (
                <p className="py-2 text-center text-[10px] text-muted-foreground">-</p>
              ) : (
                dayPosts.map((post, i) => (
                  <div key={i} className="rounded border bg-card p-1.5">
                    <p className="text-[10px] leading-tight line-clamp-2 font-medium">{post.idea_title || 'Untitled'}</p>
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {post.pillar && (
                        <span className={cn(
                          'rounded px-1 py-0.5 text-[8px]',
                          PILLAR_COLORS[post.pillar] || 'bg-secondary'
                        )}>
                          {CONTENT_PILLAR_LABELS[post.pillar]?.split(' ')[0] || post.pillar}
                        </span>
                      )}
                      {post.template_name && (
                        <span className="rounded bg-secondary px-1 py-0.5 text-[8px]">
                          {post.template_name}
                        </span>
                      )}
                      {post.match_score !== undefined && post.match_score > 0 && (
                        <span className="rounded bg-secondary px-1 py-0.5 text-[8px]">
                          {Math.round(post.match_score * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

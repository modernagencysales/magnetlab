'use client';

import { useMemo, Fragment } from 'react';
import { startOfWeek, addDays, format, isSameDay, isToday as dateFnsIsToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { GridCell } from './GridCell';
import type { PipelinePost, PostingSlot, TeamProfileWithConnection } from '@/lib/types/content-pipeline';

interface WeeklyGridProps {
  profiles: TeamProfileWithConnection[];
  posts: PipelinePost[];
  slots: PostingSlot[];
  weekStart: Date;
  onCellClick: (profileId: string, date: Date, post: PipelinePost | null) => void;
  onPostClick: (post: PipelinePost) => void;
  onPostContextMenu?: (post: PipelinePost, e: React.MouseEvent) => void;
}

/**
 * Find the slot for a given profile on a given day-of-week index (0=Mon..6=Sun).
 * Slots with day_of_week=null are "daily" and apply to every day.
 */
function getSlotForDay(slots: PostingSlot[], profileId: string, dayOfWeek: number): PostingSlot | null {
  return (
    slots.find(
      (s) => s.team_profile_id === profileId && (s.day_of_week === dayOfWeek || s.day_of_week === null)
    ) ?? null
  );
}

/**
 * Find a post assigned to a given profile on a given date.
 */
function getPostForCell(posts: PipelinePost[], profileId: string, date: Date): PipelinePost | null {
  return (
    posts.find(
      (p) =>
        p.team_profile_id === profileId &&
        p.scheduled_time &&
        isSameDay(new Date(p.scheduled_time), date)
    ) ?? null
  );
}

/** Build initials from a full name */
function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function WeeklyGrid({
  profiles,
  posts,
  slots,
  weekStart,
  onCellClick,
  onPostClick,
  onPostContextMenu,
}: WeeklyGridProps) {
  // Build the 7 days of the week (Mon-Sun)
  const weekDays = useMemo(() => {
    const start = startOfWeek(weekStart, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekStart]);

  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-[900px] gap-px rounded-lg border bg-border"
        style={{ gridTemplateColumns: '180px repeat(7, 1fr)' }}
      >
        {/* ---- Header Row ---- */}
        <div className="bg-muted/70 p-2 text-xs font-semibold text-muted-foreground flex items-end">
          Team Member
        </div>
        {weekDays.map((day) => {
          const today = dateFnsIsToday(day);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                'bg-muted/70 p-2 text-center',
                today && 'bg-blue-50 dark:bg-blue-950/40'
              )}
            >
              <p className={cn('text-xs font-semibold', today && 'text-blue-600 dark:text-blue-400')}>
                {format(day, 'EEE')}
              </p>
              <p className={cn('text-[10px] text-muted-foreground', today && 'text-blue-500')}>
                {format(day, 'MMM d')}
              </p>
            </div>
          );
        })}

        {/* ---- Profile Rows ---- */}
        {profiles.map((profile) => (
          <Fragment key={profile.id}>
            {/* Profile name cell */}
            <div
              className="flex items-center gap-2 bg-card px-3 py-2"
            >
              {/* Avatar or initials */}
              <div className="relative flex-shrink-0">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="h-7 w-7 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                    {initials(profile.full_name)}
                  </div>
                )}
                {/* LinkedIn status dot */}
                <span
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card',
                    profile.linkedin_connected ? 'bg-green-500' : 'bg-red-400'
                  )}
                  title={profile.linkedin_connected ? 'LinkedIn connected' : 'Not connected'}
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{profile.full_name}</p>
                {profile.title && (
                  <p className="truncate text-[10px] text-muted-foreground">{profile.title}</p>
                )}
              </div>
            </div>

            {/* 7 day cells */}
            {weekDays.map((day, dayIdx) => {
              const post = getPostForCell(posts, profile.id, day);
              const slot = getSlotForDay(slots, profile.id, dayIdx);
              const today = dateFnsIsToday(day);

              return (
                <div
                  key={`${profile.id}-${day.toISOString()}`}
                  className={cn(
                    'bg-card p-1',
                    today && 'bg-blue-50/30 dark:bg-blue-950/10'
                  )}
                >
                  <GridCell
                    post={post}
                    slotTime={slot?.time_of_day ?? null}
                    hasSlot={!!slot}
                    isToday={today}
                    onCellClick={() => {
                      if (post) {
                        onPostClick(post);
                      } else {
                        onCellClick(profile.id, day, null);
                      }
                    }}
                    onContextMenu={
                      post && onPostContextMenu
                        ? (e) => onPostContextMenu(post, e)
                        : undefined
                    }
                  />
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

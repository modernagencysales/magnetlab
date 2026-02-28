'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { ChevronLeft, ChevronRight, Loader2, X, Calendar } from 'lucide-react';
import { startOfWeek, addWeeks, subWeeks, format, addDays, setHours, setMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { WeeklyGrid } from './WeeklyGrid';
import { PostDetailModal } from './PostDetailModal';
import { TeamLinkedInConnect } from './TeamLinkedInConnect';
import { BroadcastModal } from './BroadcastModal';
import { GridContextMenu } from './GridContextMenu';
import type { PipelinePost, PostingSlot, TeamProfileWithConnection } from '@/lib/types/content-pipeline';

interface CollisionItem {
  post_a_id: string;
  post_b_id: string;
  overlap_description: string;
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

interface CollisionResult {
  has_collision: boolean;
  collisions: CollisionItem[];
}

interface TeamCommandCenterProps {
  teamId: string;
}

interface ScheduleData {
  profiles: TeamProfileWithConnection[];
  posts: PipelinePost[];
  slots: PostingSlot[];
  buffer_posts: PipelinePost[];
  week_start: string;
  week_end: string;
  collisions?: CollisionResult | null;
}

export function TeamCommandCenter({ teamId }: TeamCommandCenterProps) {
  // --- State ---
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [data, setData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);

  // Post detail modal
  const [selectedPost, setSelectedPost] = useState<PipelinePost | null>(null);
  const [polishing, setPolishing] = useState(false);

  // Buffer dock
  const [showBufferDock, setShowBufferDock] = useState(false);
  const [assignTarget, setAssignTarget] = useState<{ profileId: string; date: Date } | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null); // post id being assigned

  // Broadcast modal
  const [broadcastPost, setBroadcastPost] = useState<PipelinePost | null>(null);

  // Collision detection
  const [collisions, setCollisions] = useState<CollisionResult | null>(null);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{ post: PipelinePost; x: number; y: number } | null>(null);

  // --- Fetch schedule data ---
  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/content-pipeline/team-schedule?team_id=${teamId}&week_start=${weekStart.toISOString()}`
      );
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [teamId, weekStart]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // Read collisions from the initial fetch response
  useEffect(() => {
    if (data?.collisions) {
      setCollisions(data.collisions);
    } else {
      setCollisions(null);
    }
  }, [data]);

  // --- Navigation ---
  const goThisWeek = () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const goPrev = () => setWeekStart((prev) => subWeeks(prev, 1));
  const goNext = () => setWeekStart((prev) => addWeeks(prev, 1));

  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;

  // --- Stats ---
  const scheduledCount = data?.posts.filter((p) => p.status === 'scheduled').length ?? 0;
  const bufferCount = data?.buffer_posts.length ?? 0;
  const connectedCount = data?.profiles.filter((p) => p.linkedin_connected).length ?? 0;
  const totalProfiles = data?.profiles.length ?? 0;

  // --- Cell click handler (empty slot) ---
  const handleCellClick = (profileId: string, date: Date, post: PipelinePost | null) => {
    if (post) {
      setSelectedPost(post);
      return;
    }
    // Open buffer dock for assignment
    setAssignTarget({ profileId, date });
    setShowBufferDock(true);
  };

  // --- Post click handler ---
  const handlePostClick = (post: PipelinePost) => {
    setSelectedPost(post);
  };

  // --- Assign post from buffer ---
  const handleAssignPost = async (post: PipelinePost) => {
    if (!assignTarget) return;

    setAssigning(post.id);
    try {
      // Find the slot time for this profile on this day (JS getDay: 0=Sun, 1=Mon..6=Sat)
      const dayOfWeek = assignTarget.date.getDay();
      const slot = data?.slots.find(
        (s) =>
          s.team_profile_id === assignTarget.profileId &&
          (s.day_of_week === dayOfWeek || s.day_of_week === null)
      );

      // Build scheduled_time from date + slot time
      let scheduledTime = assignTarget.date;
      if (slot?.time_of_day) {
        const [hStr, mStr] = slot.time_of_day.split(':');
        scheduledTime = setMinutes(setHours(assignTarget.date, parseInt(hStr, 10)), parseInt(mStr || '0', 10));
      } else {
        // Default to 9:00 AM if no slot time
        scheduledTime = setMinutes(setHours(assignTarget.date, 9), 0);
      }

      const res = await fetch('/api/content-pipeline/team-schedule/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: post.id,
          scheduled_time: scheduledTime.toISOString(),
          team_profile_id: assignTarget.profileId,
        }),
      });

      if (res.ok) {
        setShowBufferDock(false);
        setAssignTarget(null);
        await fetchSchedule();
      }
    } catch {
      // Silent
    } finally {
      setAssigning(null);
    }
  };

  // --- Polish handler (for PostDetailModal) ---
  const handlePolish = async (postId: string) => {
    setPolishing(true);
    try {
      await fetch(`/api/content-pipeline/posts/${postId}/polish`, { method: 'POST' });
      await fetchSchedule();
    } catch {
      // Silent
    } finally {
      setPolishing(false);
    }
  };

  // --- Broadcast handler (opens BroadcastModal for a given post) ---
  const handleBroadcast = (post: PipelinePost) => {
    setBroadcastPost(post);
  };

  // --- Buffer posts for the selected profile ---
  const bufferPostsForProfile = assignTarget
    ? (data?.buffer_posts || []).filter((p) => p.team_profile_id === assignTarget.profileId)
    : [];

  const assignTargetProfile = assignTarget
    ? data?.profiles.find((p) => p.id === assignTarget.profileId)
    : null;

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className="rounded-lg p-1.5 hover:bg-secondary transition-colors"
            title="Previous week"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={goThisWeek}
            className="rounded-lg border border-border px-3 py-1 text-xs font-medium hover:bg-muted transition-colors"
          >
            This Week
          </button>
          <button
            onClick={goNext}
            className="rounded-lg p-1.5 hover:bg-secondary transition-colors"
            title="Next week"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {weekLabel}
        </div>
      </div>

      {/* Stats Bar */}
      {data && !loading && (
        <div className="flex flex-wrap gap-3">
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-950 dark:text-green-300">
            {scheduledCount} scheduled
          </span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            {bufferCount} in buffer
          </span>
          <span className={cn(
            'rounded-full px-3 py-1 text-xs font-medium',
            connectedCount === totalProfiles
              ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
              : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
          )}>
            {connectedCount}/{totalProfiles} connected
          </span>
        </div>
      )}

      {/* LinkedIn Connection Banner */}
      {data && !loading && (
        <TeamLinkedInConnect profiles={data.profiles} onRefresh={fetchSchedule} />
      )}

      {/* Collision Warning Banner */}
      {collisions?.has_collision && collisions.collisions.length > 0 && (
        <div className="rounded-lg border border-orange-300 bg-orange-50 p-4 dark:border-orange-700 dark:bg-orange-950/40">
          <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-200">
            Content overlap detected
          </h4>
          <div className="mt-2 space-y-2">
            {collisions.collisions.map((c, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span
                  className={cn(
                    'mt-1 h-2 w-2 flex-shrink-0 rounded-full',
                    c.severity === 'high' && 'bg-red-500',
                    c.severity === 'medium' && 'bg-orange-500',
                    c.severity === 'low' && 'bg-yellow-500'
                  )}
                />
                <div>
                  <span className="text-orange-800 dark:text-orange-200">
                    {c.overlap_description}
                  </span>
                  {c.suggestion && (
                    <span className="ml-1 text-orange-600 dark:text-orange-400">
                      — {c.suggestion}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data && data.profiles.length > 0 ? (
        <WeeklyGrid
          profiles={data.profiles}
          posts={data.posts}
          slots={data.slots}
          weekStart={weekStart}
          onCellClick={handleCellClick}
          onPostClick={handlePostClick}
          onPostContextMenu={(post, e) => {
            e.preventDefault();
            setContextMenu({ post, x: e.clientX, y: e.clientY });
          }}
        />
      ) : (
        <div className="rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
          No team profiles found. Add team members in Settings to get started.
        </div>
      )}

      {/* Buffer Dock (bottom panel) */}
      {showBufferDock && assignTarget && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card shadow-2xl">
          <div className="mx-auto max-w-6xl px-4 py-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">
                  Assign to {assignTargetProfile?.full_name ?? 'team member'}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {format(assignTarget.date, 'EEEE, MMM d')}
                </span>
              </div>
              <button
                onClick={() => {
                  setShowBufferDock(false);
                  setAssignTarget(null);
                }}
                className="rounded-lg p-1 hover:bg-secondary transition-colors"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {bufferPostsForProfile.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No buffer posts available for this profile. Create posts first in the Posts tab.
              </p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {bufferPostsForProfile.map((bp) => {
                  const preview = (bp.final_content || bp.draft_content || '').slice(0, 80);
                  const isAssigning = assigning === bp.id;

                  return (
                    <button
                      key={bp.id}
                      onClick={() => handleAssignPost(bp)}
                      disabled={!!assigning}
                      className={cn(
                        'flex-shrink-0 w-56 rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/50 disabled:opacity-50',
                        isAssigning && 'border-primary'
                      )}
                    >
                      {isAssigning ? (
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : (
                        <Fragment>
                          <p className="text-xs font-medium line-clamp-3 leading-tight">
                            {preview || 'Empty post'}
                          </p>
                          <p className="mt-1.5 text-[10px] text-muted-foreground">
                            Buffer #{bp.buffer_position ?? '?'}
                          </p>
                        </Fragment>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Post Detail Modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onPolish={handlePolish}
          onUpdate={() => {
            setSelectedPost(null);
            fetchSchedule();
          }}
          polishing={polishing}
        />
      )}

      {/* Broadcast Modal */}
      {broadcastPost && data && (
        <BroadcastModal
          post={broadcastPost}
          profiles={data.profiles}
          onClose={() => setBroadcastPost(null)}
          onBroadcast={() => {
            setBroadcastPost(null);
            fetchSchedule();
          }}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <GridContextMenu
          post={contextMenu.post}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onViewDetails={() => {
            setSelectedPost(contextMenu.post);
            setContextMenu(null);
          }}
          onBroadcast={() => {
            handleBroadcast(contextMenu.post);
            setContextMenu(null);
          }}
          onReschedule={() => {
            setSelectedPost(contextMenu.post);
            setContextMenu(null);
          }}
          onRemoveFromSchedule={async () => {
            const post = contextMenu.post;
            setContextMenu(null);
            try {
              await fetch(`/api/content-pipeline/posts/${post.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  status: 'approved',
                  scheduled_time: null,
                  is_buffer: true,
                }),
              });
              await fetchSchedule();
            } catch {
              // Silent
            }
          }}
        />
      )}
    </div>
  );
}

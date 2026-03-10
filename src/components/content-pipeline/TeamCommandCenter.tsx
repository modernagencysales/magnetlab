'use client';

import { Fragment } from 'react';
import { ChevronLeft, ChevronRight, Loader2, X, Calendar } from 'lucide-react';
import { Button, Badge } from '@magnetlab/magnetui';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { WeeklyGrid } from './WeeklyGrid';
import { PostDetailModal } from './PostDetailModal';
import { TeamLinkedInConnect } from './TeamLinkedInConnect';
import { BroadcastModal } from './BroadcastModal';
import { GridContextMenu } from './GridContextMenu';
import { useTeamCommandCenter } from '@/frontend/hooks/useTeamCommandCenter';

interface TeamCommandCenterProps {
  teamId: string;
}

export function TeamCommandCenter({ teamId }: TeamCommandCenterProps) {
  const {
    scheduleData,
    loading,
    weekStart,
    weekLabel,
    selectedPost,
    polishing,
    showBufferDock,
    assignTarget,
    assigning,
    broadcastPost,
    collisions,
    contextMenu,
    bufferPostsForProfile,
    assignTargetProfile,
    setSelectedPost,
    setShowBufferDock,
    setAssignTarget,
    setContextMenu,
    setBroadcastPost,
    refresh,
    goThisWeek,
    goPrev,
    goNext,
    handleCellClick,
    handlePostClick,
    handleAssignPost,
    handlePolish,
    handleBroadcast,
    handleRemoveFromSchedule,
    handlePostUpdate,
    handleBroadcastComplete,
  } = useTeamCommandCenter(teamId);

  const scheduledCount = scheduleData?.posts.filter((p) => p.status === 'scheduled').length ?? 0;
  const bufferCount = scheduleData?.buffer_posts.length ?? 0;
  const connectedCount = scheduleData?.profiles.filter((p) => p.linkedin_connected).length ?? 0;
  const totalProfiles = scheduleData?.profiles.length ?? 0;

  return (
    <div className="space-y-4">
      {/* Week Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" onClick={goPrev} title="Previous week">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button variant="outline" size="sm" onClick={goThisWeek}>
            This Week
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={goNext} title="Next week">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {weekLabel}
        </div>
      </div>

      {/* Stats Bar */}
      {scheduleData && !loading && (
        <div className="flex flex-wrap gap-3">
          <Badge variant="green">{scheduledCount} scheduled</Badge>
          <Badge variant="orange">{bufferCount} in buffer</Badge>
          <Badge variant={connectedCount === totalProfiles ? 'green' : 'gray'}>
            {connectedCount}/{totalProfiles} connected
          </Badge>
        </div>
      )}

      {/* LinkedIn Connection Banner */}
      {scheduleData && !loading && (
        <TeamLinkedInConnect profiles={scheduleData.profiles} onRefresh={refresh} />
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
      ) : scheduleData && scheduleData.profiles.length > 0 ? (
        <WeeklyGrid
          profiles={scheduleData.profiles}
          posts={scheduleData.posts}
          slots={scheduleData.slots}
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

      {/* Buffer Dock */}
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
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setShowBufferDock(false);
                  setAssignTarget(null);
                }}
                title="Close"
              >
                <X className="h-4 w-4" />
              </Button>
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
          onUpdate={handlePostUpdate}
          polishing={polishing}
        />
      )}

      {/* Broadcast Modal */}
      {broadcastPost && scheduleData && (
        <BroadcastModal
          post={broadcastPost}
          profiles={scheduleData.profiles}
          onClose={() => setBroadcastPost(null)}
          onBroadcast={handleBroadcastComplete}
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
          onRemoveFromSchedule={handleRemoveFromSchedule}
        />
      )}
    </div>
  );
}

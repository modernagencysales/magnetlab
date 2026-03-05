'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { startOfWeek, addWeeks, subWeeks, format, addDays, setHours, setMinutes } from 'date-fns';
import type {
  PipelinePost,
  PostingSlot,
  TeamProfileWithConnection,
} from '@/lib/types/content-pipeline';
import * as teamScheduleApi from '@/frontend/api/content-pipeline/team-schedule';
import * as postsApi from '@/frontend/api/content-pipeline/posts';

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

export interface ScheduleData {
  profiles: TeamProfileWithConnection[];
  posts: PipelinePost[];
  slots: PostingSlot[];
  buffer_posts: PipelinePost[];
  week_start: string;
  week_end: string;
  collisions?: CollisionResult | null;
}

export interface TeamCommandCenterState {
  scheduleData: ScheduleData | null;
  loading: boolean;
  weekStart: Date;
  weekLabel: string;
  selectedPost: PipelinePost | null;
  polishing: boolean;
  showBufferDock: boolean;
  assignTarget: { profileId: string; date: Date } | null;
  assigning: string | null;
  broadcastPost: PipelinePost | null;
  collisions: CollisionResult | null;
  contextMenu: { post: PipelinePost; x: number; y: number } | null;
  bufferPostsForProfile: PipelinePost[];
  assignTargetProfile: TeamProfileWithConnection | null | undefined;
  setSelectedPost: React.Dispatch<React.SetStateAction<PipelinePost | null>>;
  setShowBufferDock: React.Dispatch<React.SetStateAction<boolean>>;
  setAssignTarget: React.Dispatch<React.SetStateAction<{ profileId: string; date: Date } | null>>;
  setContextMenu: React.Dispatch<
    React.SetStateAction<{ post: PipelinePost; x: number; y: number } | null>
  >;
  setBroadcastPost: React.Dispatch<React.SetStateAction<PipelinePost | null>>;
  refresh: () => Promise<void>;
  goThisWeek: () => void;
  goPrev: () => void;
  goNext: () => void;
  handleCellClick: (profileId: string, date: Date, post: PipelinePost | null) => void;
  handlePostClick: (post: PipelinePost) => void;
  handleAssignPost: (post: PipelinePost) => Promise<void>;
  handlePolish: (postId: string) => Promise<void>;
  handleBroadcast: (post: PipelinePost) => void;
  handleRemoveFromSchedule: () => Promise<void>;
  handlePostUpdate: () => void;
  handleBroadcastComplete: () => void;
}

export function useTeamCommandCenter(teamId: string): TeamCommandCenterState {
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedPost, setSelectedPost] = useState<PipelinePost | null>(null);
  const [polishing, setPolishing] = useState(false);

  const [showBufferDock, setShowBufferDock] = useState(false);
  const [assignTarget, setAssignTarget] = useState<{ profileId: string; date: Date } | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);

  const [broadcastPost, setBroadcastPost] = useState<PipelinePost | null>(null);
  const [collisions, setCollisions] = useState<CollisionResult | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    post: PipelinePost;
    x: number;
    y: number;
  } | null>(null);

  const fetchSchedule = useCallback(async () => {
    setLoading(true);
    try {
      const json = await teamScheduleApi.getTeamSchedule({
        team_id: teamId,
        week_start: weekStart.toISOString(),
      });
      setScheduleData(json as unknown as ScheduleData);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [teamId, weekStart]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  useEffect(() => {
    if (scheduleData?.collisions) {
      setCollisions(scheduleData.collisions);
    } else {
      setCollisions(null);
    }
  }, [scheduleData]);

  const weekEnd = addDays(weekStart, 6);
  const weekLabel = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;

  const goThisWeek = useCallback(
    () => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 })),
    []
  );
  const goPrev = useCallback(() => setWeekStart((prev) => subWeeks(prev, 1)), []);
  const goNext = useCallback(() => setWeekStart((prev) => addWeeks(prev, 1)), []);

  const handleCellClick = useCallback(
    (profileId: string, date: Date, post: PipelinePost | null) => {
      if (post) {
        setSelectedPost(post);
        return;
      }
      setAssignTarget({ profileId, date });
      setShowBufferDock(true);
    },
    []
  );

  const handlePostClick = useCallback((post: PipelinePost) => {
    setSelectedPost(post);
  }, []);

  const handleAssignPost = useCallback(
    async (post: PipelinePost) => {
      if (!assignTarget) return;

      setAssigning(post.id);
      try {
        const dayOfWeek = assignTarget.date.getDay();
        const slot = scheduleData?.slots.find(
          (s) =>
            s.team_profile_id === assignTarget.profileId &&
            (s.day_of_week === dayOfWeek || s.day_of_week === null)
        );

        let scheduledTime = assignTarget.date;
        if (slot?.time_of_day) {
          const [hStr, mStr] = slot.time_of_day.split(':');
          scheduledTime = setMinutes(
            setHours(assignTarget.date, parseInt(hStr, 10)),
            parseInt(mStr || '0', 10)
          );
        } else {
          scheduledTime = setMinutes(setHours(assignTarget.date, 9), 0);
        }

        await teamScheduleApi.assignPost({
          post_id: post.id,
          scheduled_time: scheduledTime.toISOString(),
          team_profile_id: assignTarget.profileId,
        });
        setShowBufferDock(false);
        setAssignTarget(null);
        await fetchSchedule();
      } catch {
        // Silent
      } finally {
        setAssigning(null);
      }
    },
    [assignTarget, scheduleData, fetchSchedule]
  );

  const handlePolish = useCallback(
    async (postId: string) => {
      setPolishing(true);
      try {
        await postsApi.polishPost(postId);
        await fetchSchedule();
      } catch {
        // Silent
      } finally {
        setPolishing(false);
      }
    },
    [fetchSchedule]
  );

  const handleBroadcast = useCallback((post: PipelinePost) => {
    setBroadcastPost(post);
  }, []);

  const handleRemoveFromSchedule = useCallback(async () => {
    if (!contextMenu) return;
    const post = contextMenu.post;
    setContextMenu(null);
    try {
      await postsApi.updatePost(post.id, {
        status: 'approved',
        scheduled_time: null,
        is_buffer: true,
      });
      await fetchSchedule();
    } catch {
      // Silent
    }
  }, [contextMenu, fetchSchedule]);

  const handlePostUpdate = useCallback(() => {
    setSelectedPost(null);
    fetchSchedule();
  }, [fetchSchedule]);

  const handleBroadcastComplete = useCallback(() => {
    setBroadcastPost(null);
    fetchSchedule();
  }, [fetchSchedule]);

  const bufferPostsForProfile = useMemo(
    () =>
      assignTarget
        ? (scheduleData?.buffer_posts || []).filter(
            (p) => p.team_profile_id === assignTarget.profileId
          )
        : [],
    [assignTarget, scheduleData]
  );

  const assignTargetProfile = useMemo(
    () =>
      assignTarget ? scheduleData?.profiles.find((p) => p.id === assignTarget.profileId) : null,
    [assignTarget, scheduleData]
  );

  return {
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
    refresh: fetchSchedule,
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
  };
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, Loader2, Clock, Plus, Trash2, Settings } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Badge,
  Checkbox,
} from '@magnetlab/magnetui';
import { BufferQueueCard } from './BufferQueueCard';
import { PlannerView } from './PlannerView';
import { BusinessContextModal } from './BusinessContextModal';
import type {
  PipelinePost,
  PostingSlot,
  PillarDistribution,
  ContentPillar,
} from '@/lib/types/content-pipeline';
import { CONTENT_PILLAR_LABELS } from '@/lib/types/content-pipeline';
import * as scheduleApi from '@/frontend/api/content-pipeline/schedule';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface AutopilotTabProps {
  profileId?: string | null;
}

export function AutopilotTab({ profileId }: AutopilotTabProps) {
  const [buffer, setBuffer] = useState<PipelinePost[]>([]);
  const [slots, setSlots] = useState<PostingSlot[]>([]);
  const [autopilotStatus, setAutopilotStatus] = useState<{
    bufferSize: number;
    nextScheduledSlot: string;
    pillarCounts: PillarDistribution;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);

  // Autopilot config
  const [postsPerBatch, setPostsPerBatch] = useState(3);
  const [autoPublish, setAutoPublish] = useState(false);
  const [runningAutopilot, setRunningAutopilot] = useState(false);

  // Add slot form
  const [showAddSlot, setShowAddSlot] = useState(false);
  const [newSlotTime, setNewSlotTime] = useState('09:00');
  const [newSlotDay, setNewSlotDay] = useState<string>('');
  const [newSlotTimezone, setNewSlotTimezone] = useState('UTC');
  const [addingSlot, setAddingSlot] = useState(false);
  const [showBusinessContext, setShowBusinessContext] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [bufferResult, slotsResult, statusResult] = await Promise.allSettled([
        scheduleApi.getBuffer(),
        scheduleApi.getSlots(),
        scheduleApi.getAutopilotStatus(),
      ]);

      if (bufferResult.status === 'fulfilled')
        setBuffer((bufferResult.value.buffer || []) as PipelinePost[]);
      if (slotsResult.status === 'fulfilled')
        setSlots((slotsResult.value.slots || []) as PostingSlot[]);
      if (statusResult.status === 'fulfilled')
        setAutopilotStatus(
          statusResult.value as unknown as {
            bufferSize: number;
            nextScheduledSlot: string;
            pillarCounts: PillarDistribution;
          }
        );
    } catch {
      // Silent failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleBufferAction = async (postId: string, action: 'approve' | 'reject') => {
    setActionId(postId);
    setActionType(action);
    try {
      await scheduleApi.bufferAction(postId, action);
      await fetchAll();
    } catch {
      // Silent failure
    } finally {
      setActionId(null);
      setActionType(null);
    }
  };

  const handleRunAutopilot = async () => {
    setRunningAutopilot(true);
    try {
      await scheduleApi.triggerAutopilot({
        postsPerBatch,
        autoPublish,
        profileId: profileId ?? undefined,
      });
      // Refresh after a short delay to let the task start
      setTimeout(() => fetchAll(), 2000);
    } catch {
      // Silent failure
    } finally {
      setRunningAutopilot(false);
    }
  };

  const handleAddSlot = async () => {
    setAddingSlot(true);
    try {
      await scheduleApi.createSlot({
        time_of_day: newSlotTime,
        day_of_week: newSlotDay ? parseInt(newSlotDay) : null,
        timezone: newSlotTimezone,
      });
      setShowAddSlot(false);
      setNewSlotTime('09:00');
      setNewSlotDay('');
      await fetchAll();
    } catch {
      // Silent failure
    } finally {
      setAddingSlot(false);
    }
  };

  const handleToggleSlot = async (slot: PostingSlot) => {
    try {
      await scheduleApi.updateSlot(slot.id, { is_active: !slot.is_active });
      await fetchAll();
    } catch {
      // Silent failure
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    try {
      await scheduleApi.deleteSlot(slotId);
      await fetchAll();
    } catch {
      // Silent failure
    }
  };

  const getRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return 'Soon';
    if (diffHours < 24) return `In ${diffHours}h`;
    const diffDays = Math.round(diffHours / 24);
    return `In ${diffDays}d`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Week Planner */}
      <PlannerView />

      {/* Business Context */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setShowBusinessContext(true)}>
          <Settings className="h-3 w-3" />
          Business Context
        </Button>
      </div>
      {showBusinessContext && (
        <BusinessContextModal onClose={() => setShowBusinessContext(false)} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Buffer Size</p>
          <p className="mt-1 text-2xl font-semibold">
            {autopilotStatus?.bufferSize || 0} posts ready
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Next Post</p>
          <p className="mt-1 text-2xl font-semibold">
            {autopilotStatus?.nextScheduledSlot
              ? getRelativeTime(autopilotStatus.nextScheduledSlot)
              : 'No slot'}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">Pillar Balance</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {autopilotStatus?.pillarCounts &&
              Object.entries(autopilotStatus.pillarCounts).map(([pillar, count]) =>
                count > 0 ? (
                  <span key={pillar} className="text-xs text-muted-foreground">
                    {CONTENT_PILLAR_LABELS[pillar as ContentPillar]?.split(' ')[0]}: {count}
                  </span>
                ) : null
              )}
            {!autopilotStatus?.pillarCounts ||
            Object.values(autopilotStatus.pillarCounts).every((v) => v === 0) ? (
              <span className="text-sm text-muted-foreground">No posts yet</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Buffer Queue */}
      <div>
        <h3 className="mb-4 text-sm font-semibold uppercase text-muted-foreground">Buffer Queue</h3>
        {buffer.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Buffer is empty. Run autopilot to fill it.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {buffer.map((post, i) => (
              <BufferQueueCard
                key={post.id}
                post={post}
                position={i + 1}
                onApprove={(id) => handleBufferAction(id, 'approve')}
                onReject={(id) => handleBufferAction(id, 'reject')}
                approving={actionId === post.id && actionType === 'approve'}
                rejecting={actionId === post.id && actionType === 'reject'}
              />
            ))}
          </div>
        )}
      </div>

      {/* Posting Schedule */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">
            Posting Schedule
          </h3>
          <Button variant="outline" size="sm" onClick={() => setShowAddSlot(!showAddSlot)}>
            <Plus className="mr-1 h-3 w-3" />
            Add Slot
          </Button>
        </div>

        {showAddSlot && (
          <div className="mb-4 rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="mb-1">Time</Label>
                <Input
                  type="time"
                  value={newSlotTime}
                  onChange={(e) => setNewSlotTime(e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1">Day (optional)</Label>
                <Select value={newSlotDay} onValueChange={setNewSlotDay}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Any day" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Any day</SelectItem>
                    {DAYS.map((d, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1">Timezone</Label>
                <Select value={newSlotTimezone} onValueChange={setNewSlotTimezone}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">Eastern</SelectItem>
                    <SelectItem value="America/Chicago">Central</SelectItem>
                    <SelectItem value="America/Denver">Mountain</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific</SelectItem>
                    <SelectItem value="Europe/London">London</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddSlot} disabled={addingSlot} size="sm">
                {addingSlot ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
              </Button>
            </div>
          </div>
        )}

        {slots.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Clock className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">No posting slots configured</p>
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {slots.map((slot) => (
              <div
                key={slot.id}
                className="flex items-center justify-between rounded-lg border bg-card p-3"
              >
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{slot.time_of_day}</p>
                    <p className="text-xs text-muted-foreground">
                      {slot.day_of_week !== null ? DAYS[slot.day_of_week] : 'Every day'} ·{' '}
                      {slot.timezone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={slot.is_active ? 'green' : 'gray'}
                    className="cursor-pointer"
                    onClick={() => handleToggleSlot(slot)}
                  >
                    {slot.is_active ? 'Active' : 'Paused'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDeleteSlot(slot.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Run Autopilot */}
      <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Zap className="h-6 w-6 text-primary" />
          <h3 className="text-base font-semibold">Run Autopilot</h3>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-4">
          <div>
            <Label className="mb-1">Posts per batch</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={postsPerBatch}
              onChange={(e) => setPostsPerBatch(parseInt(e.target.value) || 3)}
              className="w-20"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={autoPublish}
              onCheckedChange={(checked) => setAutoPublish(checked === true)}
            />
            Auto-publish after review window
          </label>
        </div>

        <Button onClick={handleRunAutopilot} disabled={runningAutopilot}>
          {runningAutopilot ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" />
              Run Autopilot
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

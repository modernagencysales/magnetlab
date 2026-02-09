'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, Loader2, Clock, Plus, Trash2, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BufferQueueCard } from './BufferQueueCard';
import { PlannerView } from './PlannerView';
import { BusinessContextModal } from './BusinessContextModal';
import type { PipelinePost, PostingSlot, PillarDistribution, ContentPillar } from '@/lib/types/content-pipeline';
import { CONTENT_PILLAR_LABELS } from '@/lib/types/content-pipeline';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AutopilotTab() {
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
        fetch('/api/content-pipeline/schedule/buffer').then((r) => r.json()),
        fetch('/api/content-pipeline/schedule/slots').then((r) => r.json()),
        fetch('/api/content-pipeline/schedule/autopilot').then((r) => r.json()),
      ]);

      if (bufferResult.status === 'fulfilled') setBuffer(bufferResult.value.buffer || []);
      if (slotsResult.status === 'fulfilled') setSlots(slotsResult.value.slots || []);
      if (statusResult.status === 'fulfilled') setAutopilotStatus(statusResult.value);
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
      const response = await fetch('/api/content-pipeline/schedule/buffer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, action }),
      });
      if (response.ok) {
        await fetchAll();
      }
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
      await fetch('/api/content-pipeline/schedule/autopilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postsPerBatch, autoPublish }),
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
      const response = await fetch('/api/content-pipeline/schedule/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          time_of_day: newSlotTime,
          day_of_week: newSlotDay ? parseInt(newSlotDay) : null,
          timezone: newSlotTimezone,
        }),
      });
      if (response.ok) {
        setShowAddSlot(false);
        setNewSlotTime('09:00');
        setNewSlotDay('');
        await fetchAll();
      }
    } catch {
      // Silent failure
    } finally {
      setAddingSlot(false);
    }
  };

  const handleToggleSlot = async (slot: PostingSlot) => {
    try {
      await fetch(`/api/content-pipeline/schedule/slots/${slot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !slot.is_active }),
      });
      await fetchAll();
    } catch {
      // Silent failure
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    try {
      await fetch(`/api/content-pipeline/schedule/slots/${slotId}`, {
        method: 'DELETE',
      });
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
        <button
          onClick={() => setShowBusinessContext(true)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
        >
          <Settings className="h-3 w-3" />
          Business Context
        </button>
      </div>
      {showBusinessContext && (
        <BusinessContextModal onClose={() => setShowBusinessContext(false)} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Buffer Size</p>
          <p className="mt-1 text-2xl font-semibold">{autopilotStatus?.bufferSize || 0} posts ready</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Next Post</p>
          <p className="mt-1 text-2xl font-semibold">
            {autopilotStatus?.nextScheduledSlot
              ? getRelativeTime(autopilotStatus.nextScheduledSlot)
              : 'No slot'}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Pillar Balance</p>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            {autopilotStatus?.pillarCounts && Object.entries(autopilotStatus.pillarCounts).map(([pillar, count]) => (
              count > 0 ? (
                <span key={pillar} className="text-xs text-muted-foreground">
                  {CONTENT_PILLAR_LABELS[pillar as ContentPillar]?.split(' ')[0]}: {count}
                </span>
              ) : null
            ))}
            {!autopilotStatus?.pillarCounts || Object.values(autopilotStatus.pillarCounts).every((v) => v === 0) ? (
              <span className="text-sm text-muted-foreground">No posts yet</span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Buffer Queue */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Buffer Queue</h3>
        {buffer.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">Buffer is empty. Run autopilot to fill it.</p>
          </div>
        ) : (
          <div className="space-y-2">
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
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase text-muted-foreground">Posting Schedule</h3>
          <button
            onClick={() => setShowAddSlot(!showAddSlot)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add Slot
          </button>
        </div>

        {showAddSlot && (
          <div className="mb-4 rounded-lg border bg-card p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Time</label>
                <input
                  type="time"
                  value={newSlotTime}
                  onChange={(e) => setNewSlotTime(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Day (optional)</label>
                <select
                  value={newSlotDay}
                  onChange={(e) => setNewSlotDay(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Any day</option>
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Timezone</label>
                <select
                  value={newSlotTimezone}
                  onChange={(e) => setNewSlotTimezone(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern</option>
                  <option value="America/Chicago">Central</option>
                  <option value="America/Denver">Mountain</option>
                  <option value="America/Los_Angeles">Pacific</option>
                  <option value="Europe/London">London</option>
                </select>
              </div>
              <button
                onClick={handleAddSlot}
                disabled={addingSlot}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {addingSlot ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add'}
              </button>
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
              <div key={slot.id} className="flex items-center justify-between rounded-lg border bg-card p-3">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{slot.time_of_day}</p>
                    <p className="text-xs text-muted-foreground">
                      {slot.day_of_week !== null ? DAYS[slot.day_of_week] : 'Every day'} · {slot.timezone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleSlot(slot)}
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
                      slot.is_active
                        ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                        : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                    )}
                  >
                    {slot.is_active ? 'Active' : 'Paused'}
                  </button>
                  <button
                    onClick={() => handleDeleteSlot(slot.id)}
                    className="rounded-lg p-1 text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
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
            <label className="mb-1 block text-xs font-medium">Posts per batch</label>
            <input
              type="number"
              min={1}
              max={10}
              value={postsPerBatch}
              onChange={(e) => setPostsPerBatch(parseInt(e.target.value) || 3)}
              className="w-20 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={autoPublish}
              onChange={(e) => setAutoPublish(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            Auto-publish after review window
          </label>
        </div>

        <button
          onClick={handleRunAutopilot}
          disabled={runningAutopilot}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
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
        </button>
      </div>
    </div>
  );
}

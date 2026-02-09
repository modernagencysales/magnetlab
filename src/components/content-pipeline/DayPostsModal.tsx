'use client';

import { useState } from 'react';
import { X, Loader2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import type { PipelinePost } from '@/lib/types/content-pipeline';
import { StatusBadge } from './StatusBadge';

interface DayPostsModalProps {
  day: Date;
  posts: PipelinePost[];
  onClose: () => void;
  onUpdate: () => void;
}

export function DayPostsModal({ day, posts, onClose, onUpdate }: DayPostsModalProps) {
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [saving, setSaving] = useState(false);

  const handleReschedule = async (postId: string) => {
    if (!newDate || !newTime) return;
    setSaving(true);
    try {
      const scheduledTime = new Date(`${newDate}T${newTime}:00`).toISOString();
      await fetch(`/api/content-pipeline/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_time: scheduledTime }),
      });
      setRescheduling(null);
      onUpdate();
    } catch {
      // Silent failure
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{format(day, 'EEEE, MMM d')}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          {posts.map((post) => {
            const content = post.final_content || post.draft_content || '';
            const firstLine = content.split('\n')[0]?.substring(0, 100) || 'Untitled';

            return (
              <div key={post.id} className="rounded-lg border bg-card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <StatusBadge status={post.status} />
                  {post.scheduled_time && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {format(new Date(post.scheduled_time), 'h:mm a')}
                    </span>
                  )}
                </div>
                <p className="mb-2 text-sm line-clamp-2">{firstLine}</p>

                {rescheduling === post.id ? (
                  <div className="flex items-end gap-2">
                    <div>
                      <label className="mb-0.5 block text-[10px] font-medium">Date</label>
                      <input
                        type="date"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="mb-0.5 block text-[10px] font-medium">Time</label>
                      <input
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        className="rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <button
                      onClick={() => handleReschedule(post.id)}
                      disabled={saving}
                      className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                    </button>
                    <button
                      onClick={() => setRescheduling(null)}
                      className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setRescheduling(post.id);
                      if (post.scheduled_time) {
                        const d = new Date(post.scheduled_time);
                        setNewDate(format(d, 'yyyy-MM-dd'));
                        setNewTime(format(d, 'HH:mm'));
                      }
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    Reschedule
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

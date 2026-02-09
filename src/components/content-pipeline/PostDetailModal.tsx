'use client';

import { useState } from 'react';
import { X, Loader2, Copy, Check, Sparkles, Calendar, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { PostPreview } from './PostPreview';
import type { PipelinePost, PostVariation } from '@/lib/types/content-pipeline';

interface PostDetailModalProps {
  post: PipelinePost;
  onClose: () => void;
  onPolish: (postId: string) => void;
  onUpdate: () => void;
  polishing: boolean;
}

export function PostDetailModal({ post, onClose, onPolish, onUpdate, polishing }: PostDetailModalProps) {
  const [activeVariation, setActiveVariation] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.final_content || post.draft_content || '');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('');

  const displayContent = activeVariation !== null && post.variations?.[activeVariation]
    ? post.variations[activeVariation].content
    : post.final_content || post.draft_content || '';

  const handleSchedule = async () => {
    setScheduling(true);
    try {
      const response = await fetch('/api/content-pipeline/posts/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: post.id,
          scheduled_time: scheduleTime || undefined,
        }),
      });
      if (response.ok) {
        onUpdate();
        onClose();
      }
    } catch {
      // Silent failure
    } finally {
      setScheduling(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/content-pipeline/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ final_content: editContent }),
      });

      if (response.ok) {
        setEditing(false);
        onUpdate();
      }
    } catch {
      // Silent failure
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Post Details</h2>
            <StatusBadge status={post.status} />
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Hook Score */}
        {post.hook_score !== null && post.hook_score !== undefined && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Hook Score:</span>
            <span className={cn(
              'rounded-full px-2 py-0.5 text-sm font-semibold',
              post.hook_score >= 8 ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300' :
              post.hook_score >= 5 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' :
              'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
            )}>
              {post.hook_score}/10
            </span>
          </div>
        )}

        {/* Template & Style Badges */}
        {(post.template_id || post.style_id) && (
          <div className="mb-4 flex items-center gap-2">
            {post.template_id && (
              <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                Template applied
              </span>
            )}
            {post.style_id && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                Style applied
              </span>
            )}
          </div>
        )}

        {/* Variations Tabs */}
        {post.variations && post.variations.length > 0 && (
          <div className="mb-4 flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveVariation(null)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                activeVariation === null ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
              )}
            >
              Original
            </button>
            {post.variations.map((v: PostVariation, i: number) => (
              <button
                key={v.id}
                onClick={() => setActiveVariation(i)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                  activeVariation === i ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80'
                )}
              >
                {v.hook_type || `Variation ${i + 1}`}
              </button>
            ))}
          </div>
        )}

        {/* LinkedIn Preview */}
        <div className="mb-4">
          <PostPreview content={displayContent} />
        </div>

        {/* Edit Mode */}
        {editing ? (
          <div className="mb-4 space-y-3">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="h-48 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        ) : null}

        {/* DM Template */}
        {post.dm_template && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">DM Template</p>
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">{post.dm_template}</p>
          </div>
        )}

        {/* Polish Notes */}
        {post.polish_notes && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">Polish Notes</p>
            <p className="text-sm text-muted-foreground">{post.polish_notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              Edit
            </button>
          )}
          <button
            onClick={() => onPolish(post.id)}
            disabled={polishing}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            {polishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Polish
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={() => setShowSchedule(!showSchedule)}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
          >
            <Calendar className="h-4 w-4" />
            Schedule
          </button>
        </div>

        {/* Schedule Panel */}
        {showSchedule && (
          <div className="mt-4 rounded-lg border bg-muted/50 p-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium">Schedule Time</label>
                <input
                  type="datetime-local"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                onClick={handleSchedule}
                disabled={scheduling}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {scheduling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Schedule to LinkedIn
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

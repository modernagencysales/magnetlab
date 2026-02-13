'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Copy, Check, Sparkles, Calendar, Send, Linkedin, Users } from 'lucide-react';
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
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Engagement scraping state
  const [engagementStats, setEngagementStats] = useState<{ comments: number; reactions: number; resolved: number; pushed: number } | null>(null);
  const [scrapeEnabled, setScrapeEnabled] = useState(post.scrape_engagement || false);
  const [campaignId, setCampaignId] = useState(post.heyreach_campaign_id || '');
  const [engagementLoading, setEngagementLoading] = useState(false);
  const [engagementSaving, setEngagementSaving] = useState(false);

  const isPublishedWithLinkedIn = post.status === 'published' && !!post.linkedin_post_id;

  const fetchEngagementStats = useCallback(async () => {
    if (!isPublishedWithLinkedIn) return;
    setEngagementLoading(true);
    try {
      const res = await fetch(`/api/content-pipeline/posts/${post.id}/engagement`);
      if (res.ok) {
        const data = await res.json();
        setEngagementStats(data.stats);
        setScrapeEnabled(data.config.scrape_engagement);
        setCampaignId(data.config.heyreach_campaign_id || '');
      }
    } catch { /* silent */ } finally {
      setEngagementLoading(false);
    }
  }, [post.id, isPublishedWithLinkedIn]);

  useEffect(() => {
    fetchEngagementStats();
  }, [fetchEngagementStats]);

  const handleEngagementSave = async (updates: { scrape_engagement?: boolean; heyreach_campaign_id?: string }) => {
    setEngagementSaving(true);
    try {
      const res = await fetch(`/api/content-pipeline/posts/${post.id}/engagement`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        await fetchEngagementStats();
      }
    } catch { /* silent */ } finally {
      setEngagementSaving(false);
    }
  };

  const displayContent = activeVariation !== null && post.variations?.[activeVariation]
    ? post.variations[activeVariation].content
    : post.final_content || post.draft_content || '';

  const handleSchedule = async () => {
    setScheduling(true);
    setScheduleError(null);
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
      } else {
        const data = await response.json();
        setScheduleError(data.error || 'Failed to schedule');
      }
    } catch {
      setScheduleError('Network error. Please try again.');
    } finally {
      setScheduling(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      const response = await fetch(`/api/content-pipeline/posts/${post.id}/publish`, {
        method: 'POST',
      });
      const data = await response.json();
      if (response.ok) {
        onUpdate();
        onClose();
      } else {
        setPublishError(data.error || 'Failed to publish');
      }
    } catch {
      setPublishError('Network error. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  const canPublish = displayContent.trim().length > 0 &&
    ['draft', 'reviewing', 'approved'].includes(post.status);

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

        {/* Engagement Scraping (published posts with LinkedIn ID only) */}
        {isPublishedWithLinkedIn && (
          <div className="mb-4 rounded-lg border bg-muted/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Engagement Scraping</p>
              {engagementLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>

            {/* Stats */}
            {engagementStats && (
              <div className="mb-3 grid grid-cols-4 gap-2">
                <div className="rounded-md bg-background px-2 py-1.5 text-center">
                  <p className="text-lg font-semibold">{engagementStats.comments}</p>
                  <p className="text-xs text-muted-foreground">Comments</p>
                </div>
                <div className="rounded-md bg-background px-2 py-1.5 text-center">
                  <p className="text-lg font-semibold">{engagementStats.reactions}</p>
                  <p className="text-xs text-muted-foreground">Reactions</p>
                </div>
                <div className="rounded-md bg-background px-2 py-1.5 text-center">
                  <p className="text-lg font-semibold">{engagementStats.resolved}</p>
                  <p className="text-xs text-muted-foreground">Resolved</p>
                </div>
                <div className="rounded-md bg-background px-2 py-1.5 text-center">
                  <p className="text-lg font-semibold">{engagementStats.pushed}</p>
                  <p className="text-xs text-muted-foreground">Pushed</p>
                </div>
              </div>
            )}

            {/* Toggle */}
            <div className="mb-2 flex items-center gap-3">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={scrapeEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setScrapeEnabled(enabled);
                    handleEngagementSave({ scrape_engagement: enabled });
                  }}
                  className="peer sr-only"
                  disabled={engagementSaving}
                />
                <div className="peer h-5 w-9 rounded-full bg-gray-300 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-full dark:bg-gray-600 dark:peer-checked:bg-blue-500" />
              </label>
              <span className="text-sm">Scrape engagement from this post</span>
            </div>

            {/* Campaign ID */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">HeyReach Campaign ID</label>
                <input
                  type="text"
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  placeholder="e.g. 301276"
                  className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                onClick={() => handleEngagementSave({ heyreach_campaign_id: campaignId })}
                disabled={engagementSaving}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {engagementSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </button>
            </div>
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
          {canPublish && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Linkedin className="h-4 w-4" />}
              Publish to LinkedIn
            </button>
          )}
        </div>

        {/* Publish Error / LeadShark not configured */}
        {publishError && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/50">
            <p className="text-sm text-amber-800 dark:text-amber-200">{publishError}</p>
            {publishError.includes('Settings') && (
              <a
                href="/settings"
                className="mt-1 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Go to Settings
              </a>
            )}
          </div>
        )}

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
            {scheduleError && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/50">
                <p className="text-sm text-amber-800 dark:text-amber-200">{scheduleError}</p>
                {scheduleError.includes('Settings') && (
                  <a
                    href="/settings"
                    className="mt-1 inline-block text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Go to Settings
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

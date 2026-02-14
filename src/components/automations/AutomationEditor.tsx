'use client';

import { useState, useEffect, useCallback, KeyboardEvent } from 'react';
import { X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Automation } from './AutomationList';

// ─── Types ──────────────────────────────────────────────

interface Post {
  id: string;
  draft_content: string | null;
  final_content: string | null;
  status: string;
  linkedin_post_id: string | null;
  published_at: string | null;
}

interface AutomationEditorProps {
  open: boolean;
  automation: Automation | null; // null = create mode
  onClose: () => void;
  onSave: (saved: Automation) => void;
}

// ─── Component ──────────────────────────────────────────

export function AutomationEditor({ open, automation, onClose, onSave }: AutomationEditorProps) {
  const isEdit = !!automation;

  // ── Form state ──
  const [name, setName] = useState('');
  const [postId, setPostId] = useState<string>('');
  const [postSocialId, setPostSocialId] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [dmTemplate, setDmTemplate] = useState('');
  const [autoConnect, setAutoConnect] = useState(false);
  const [autoLike, setAutoLike] = useState(false);
  const [commentReplyTemplate, setCommentReplyTemplate] = useState('');
  const [enableFollowUp, setEnableFollowUp] = useState(false);
  const [followUpTemplate, setFollowUpTemplate] = useState('');
  const [followUpDelayHours, setFollowUpDelayHours] = useState(24);

  // ── Posts for dropdown ──
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);

  // ── Saving ──
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load posts ──
  const fetchPosts = useCallback(async () => {
    setPostsLoading(true);
    try {
      const res = await fetch('/api/content-pipeline/posts?status=published&limit=100');
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch {
      // Non-critical — user can still enter manual social ID
    } finally {
      setPostsLoading(false);
    }
  }, []);

  // ── Initialize form when opening ──
  useEffect(() => {
    if (!open) return;
    fetchPosts();

    if (automation) {
      setName(automation.name);
      setPostId(automation.post_id || '');
      setPostSocialId(automation.post_social_id || '');
      setKeywords(automation.keywords || []);
      setKeywordInput('');
      setDmTemplate(automation.dm_template || '');
      setAutoConnect(automation.auto_connect);
      setAutoLike(automation.auto_like);
      setCommentReplyTemplate(automation.comment_reply_template || '');
      setEnableFollowUp(automation.enable_follow_up);
      setFollowUpTemplate(automation.follow_up_template || '');
      setFollowUpDelayHours(Math.round((automation.follow_up_delay_minutes || 1440) / 60));
    } else {
      // Reset for create
      setName('');
      setPostId('');
      setPostSocialId('');
      setKeywords([]);
      setKeywordInput('');
      setDmTemplate('');
      setAutoConnect(false);
      setAutoLike(false);
      setCommentReplyTemplate('');
      setEnableFollowUp(false);
      setFollowUpTemplate('');
      setFollowUpDelayHours(24);
    }
    setError(null);
  }, [open, automation, fetchPosts]);

  // ── Keywords management ──

  function addKeywords(input: string) {
    const newKws = input
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k.length > 0 && !keywords.includes(k));
    if (newKws.length > 0) {
      setKeywords((prev) => [...prev, ...newKws]);
    }
    setKeywordInput('');
  }

  function handleKeywordKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addKeywords(keywordInput);
    }
  }

  function handleKeywordBlur() {
    if (keywordInput.trim()) {
      addKeywords(keywordInput);
    }
  }

  function removeKeyword(kw: string) {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  }

  // ── Post selection ──

  function handlePostSelect(selectedPostId: string) {
    setPostId(selectedPostId);
    if (selectedPostId) {
      const post = posts.find((p) => p.id === selectedPostId);
      if (post?.linkedin_post_id) {
        setPostSocialId(post.linkedin_post_id);
      }
    }
  }

  // ── Save ──

  async function handleSave() {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      name: name.trim(),
      postId: postId || null,
      postSocialId: postSocialId.trim() || null,
      keywords,
      dmTemplate: dmTemplate.trim() || null,
      autoConnect,
      autoLike,
      commentReplyTemplate: commentReplyTemplate.trim() || null,
      enableFollowUp,
      followUpTemplate: followUpTemplate.trim() || null,
      followUpDelayMinutes: followUpDelayHours * 60,
    };

    try {
      const url = isEdit
        ? `/api/linkedin/automations/${automation.id}`
        : '/api/linkedin/automations';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed to ${isEdit ? 'update' : 'create'} automation`);
      }

      const data = await res.json();
      onSave(data.automation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  // ── Helper: get post label ──

  function getPostLabel(post: Post): string {
    const content = post.final_content || post.draft_content || '';
    const firstLine = content.split('\n')[0] || 'Untitled post';
    return firstLine.length > 60 ? firstLine.slice(0, 60) + '...' : firstLine;
  }

  // ─── Render ──────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Automation' : 'New Automation'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update your comment-to-DM automation settings.'
              : 'Set up a new automation to DM commenters on your LinkedIn posts.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="automation-name">Name *</Label>
            <Input
              id="automation-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lead Magnet Post DM"
            />
          </div>

          {/* Post selection */}
          <div className="space-y-2">
            <Label htmlFor="automation-post">Post (optional)</Label>
            <select
              id="automation-post"
              value={postId}
              onChange={(e) => handlePostSelect(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">
                {postsLoading ? 'Loading posts...' : 'Select a published post...'}
              </option>
              {posts.map((post) => (
                <option key={post.id} value={post.id}>
                  {getPostLabel(post)}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Pick a published post, or enter the social ID manually below.
            </p>
          </div>

          {/* Post Social ID */}
          <div className="space-y-2">
            <Label htmlFor="automation-social-id">Post Social ID</Label>
            <Input
              id="automation-social-id"
              value={postSocialId}
              onChange={(e) => setPostSocialId(e.target.value)}
              placeholder="urn:li:activity:1234567890"
            />
            <p className="text-xs text-muted-foreground">
              The LinkedIn activity URN. Auto-filled when selecting a post above.
            </p>
          </div>

          {/* Keywords */}
          <div className="space-y-2">
            <Label htmlFor="automation-keywords">Keywords</Label>
            <Input
              id="automation-keywords"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={handleKeywordKeyDown}
              onBlur={handleKeywordBlur}
              placeholder="Type keywords and press Enter (comma-separated)"
            />
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {keywords.map((kw) => (
                  <Badge
                    key={kw}
                    variant="secondary"
                    className="gap-1 pr-1"
                  >
                    {kw}
                    <button
                      type="button"
                      onClick={() => removeKeyword(kw)}
                      className="ml-0.5 rounded-full p-0.5 hover:bg-zinc-300 dark:hover:bg-zinc-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Comments containing these keywords will trigger a DM.
            </p>
          </div>

          {/* DM Template */}
          <div className="space-y-2">
            <Label htmlFor="automation-dm-template">DM Template</Label>
            <textarea
              id="automation-dm-template"
              value={dmTemplate}
              onChange={(e) => setDmTemplate(e.target.value)}
              placeholder={"Hey {{name}}, thanks for your comment! I noticed you said \"{{comment}}\" — I'd love to share more about this..."}
              rows={4}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Use {'{{name}}'} for the commenter&apos;s name and {'{{comment}}'} for their comment text.
            </p>
          </div>

          {/* Toggles row */}
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoConnect}
                onChange={(e) => setAutoConnect(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-violet-500 focus:ring-violet-500"
              />
              <span className="text-sm">Auto-connect</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoLike}
                onChange={(e) => setAutoLike(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-violet-500 focus:ring-violet-500"
              />
              <span className="text-sm">Auto-like comment</span>
            </label>
          </div>

          {/* Comment Reply Template */}
          <div className="space-y-2">
            <Label htmlFor="automation-comment-reply">Comment Reply Template (optional)</Label>
            <textarea
              id="automation-comment-reply"
              value={commentReplyTemplate}
              onChange={(e) => setCommentReplyTemplate(e.target.value)}
              placeholder="Thanks for the comment! Just sent you a DM with more details."
              rows={2}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Publicly reply to the comment before sending the DM.
            </p>
          </div>

          {/* Follow-up section */}
          <div className="space-y-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableFollowUp}
                onChange={(e) => setEnableFollowUp(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-300 text-violet-500 focus:ring-violet-500"
              />
              <span className="text-sm font-medium">Enable Follow-up</span>
            </label>

            {enableFollowUp && (
              <div className="space-y-4 pt-1">
                <div className="space-y-2">
                  <Label htmlFor="automation-followup-template">Follow-up Template</Label>
                  <textarea
                    id="automation-followup-template"
                    value={followUpTemplate}
                    onChange={(e) => setFollowUpTemplate(e.target.value)}
                    placeholder="Hey {{name}}, just following up on my last message. Did you get a chance to check it out?"
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="automation-followup-delay">Follow-up Delay (hours)</Label>
                  <Input
                    id="automation-followup-delay"
                    type="number"
                    min={1}
                    max={720}
                    value={followUpDelayHours}
                    onChange={(e) => setFollowUpDelayHours(Number(e.target.value) || 24)}
                    className="w-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    Send a follow-up DM if no reply after this many hours.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                Saving...
              </>
            ) : isEdit ? (
              'Save Changes'
            ) : (
              'Create Automation'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

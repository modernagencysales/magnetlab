'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Loader2,
  Copy,
  Check,
  Sparkles,
  Calendar,
  Send,
  Linkedin,
  Users,
  Zap,
  MessageSquare,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Badge, Input, Textarea, Label } from '@magnetlab/magnetui';
import { StatusBadge } from './StatusBadge';
import { PostPreview } from './PostPreview';
import { SaveIndicator } from './DetailPane';
import { StyleFeedbackToast } from './StyleFeedbackToast';
import type {
  PipelinePost,
  PostVariation,
  LinkedInAutomation,
  AutomationStatus,
} from '@/lib/types/content-pipeline';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

interface PostDetailModalProps {
  post: PipelinePost;
  onClose: () => void;
  onPolish: (postId: string) => void;
  onUpdate: () => void;
  polishing: boolean;
}

export function PostDetailModal({
  post,
  onClose,
  onPolish,
  onUpdate,
  polishing,
}: PostDetailModalProps) {
  const [activeVariation, setActiveVariation] = useState<number | null>(null);
  const content =
    activeVariation !== null && post.variations?.[activeVariation]
      ? post.variations[activeVariation].content
      : post.final_content || post.draft_content || '';
  const [editContent, setEditContent] = useState(content);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [copied, setCopied] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [feedbackEditId, setFeedbackEditId] = useState<string | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Engagement scraping state
  const [engagementStats, setEngagementStats] = useState<{
    comments: number;
    reactions: number;
    resolved: number;
    pushed: number;
  } | null>(null);
  const [scrapeEnabled, setScrapeEnabled] = useState(post.scrape_engagement || false);
  const [campaignId, setCampaignId] = useState(post.heyreach_campaign_id || '');
  const [engagementLoading, setEngagementLoading] = useState(false);
  const [engagementSaving, setEngagementSaving] = useState(false);

  // Automation state
  const [automation, setAutomation] = useState<LinkedInAutomation | null>(null);
  const [automationLoading, setAutomationLoading] = useState(false);
  const [automationSaving, setAutomationSaving] = useState(false);
  const [showAutomationSetup, setShowAutomationSetup] = useState(false);
  const [autoKeywords, setAutoKeywords] = useState('');
  const [autoDmTemplate, setAutoDmTemplate] = useState(post.dm_template || '');
  const [autoConnect, setAutoConnect] = useState(false);
  const [autoLike, setAutoLike] = useState(true);
  const [autoFollowUp, setAutoFollowUp] = useState(false);
  const [autoFollowUpTemplate, setAutoFollowUpTemplate] = useState('');
  const [automationEventCount, setAutomationEventCount] = useState(0);

  // Template picker state
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templates, setTemplates] = useState<
    { id: string; name: string; structure: string; category: string | null }[]
  >([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const isPublishedWithLinkedIn = post.status === 'published' && !!post.linkedin_post_id;

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
    };
  }, []);

  // Reset when post or variation changes
  useEffect(() => {
    const newContent =
      activeVariation !== null && post.variations?.[activeVariation]
        ? post.variations[activeVariation].content
        : post.final_content || post.draft_content || '';
    setEditContent(newContent);
    setSaveState('idle');
  }, [post.id, post.draft_content, post.final_content, activeVariation, post.variations]);

  // Auto-save
  const doSave = useCallback(
    async (text: string) => {
      setSaveState('saving');
      try {
        const response = await fetch(`/api/content-pipeline/posts/${post.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ draft_content: text, final_content: null }),
        });
        if (response.ok) {
          const data = await response.json();
          setSaveState('saved');
          onUpdate();
          if (savedTimeout.current) clearTimeout(savedTimeout.current);
          savedTimeout.current = setTimeout(() => setSaveState('idle'), 2000);
          if (data.editId) {
            setFeedbackEditId(data.editId);
          }
        } else {
          setSaveState('error');
        }
      } catch {
        setSaveState('error');
      }
    },
    [post.id, onUpdate]
  );

  const handleChange = (value: string) => {
    setEditContent(value);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => doSave(value), 1500);
  };

  const handleBlur = () => {
    if (editContent !== content) {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      doSave(editContent);
    }
  };

  const handleClose = () => {
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      doSave(editContent);
    }
    onClose();
  };

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
    } catch {
      /* silent */
    } finally {
      setEngagementLoading(false);
    }
  }, [post.id, isPublishedWithLinkedIn]);

  useEffect(() => {
    fetchEngagementStats();
  }, [fetchEngagementStats]);

  const handleEngagementSave = async (updates: {
    scrape_engagement?: boolean;
    heyreach_campaign_id?: string;
  }) => {
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
    } catch {
      /* silent */
    } finally {
      setEngagementSaving(false);
    }
  };

  // Fetch automation for this post
  const fetchAutomation = useCallback(async () => {
    if (!isPublishedWithLinkedIn) return;
    setAutomationLoading(true);
    try {
      const res = await fetch('/api/linkedin/automations');
      if (res.ok) {
        const data = await res.json();
        const existing = (data.automations || []).find(
          (a: LinkedInAutomation) =>
            a.post_id === post.id || a.post_social_id === post.linkedin_post_id
        );
        if (existing) {
          setAutomation(existing);
          setAutoKeywords((existing.keywords || []).join(', '));
          setAutoDmTemplate(existing.dm_template || post.dm_template || '');
          setAutoConnect(existing.auto_connect);
          setAutoLike(existing.auto_like);
          setAutoFollowUp(existing.enable_follow_up);
          setAutoFollowUpTemplate(existing.follow_up_template || '');

          // Get event count
          const evtRes = await fetch(`/api/linkedin/automations/${existing.id}`);
          if (evtRes.ok) {
            const evtData = await evtRes.json();
            setAutomationEventCount((evtData.events || []).length);
          }
        }
      }
    } catch {
      /* silent */
    } finally {
      setAutomationLoading(false);
    }
  }, [post.id, post.linkedin_post_id, post.dm_template, isPublishedWithLinkedIn]);

  useEffect(() => {
    fetchAutomation();
  }, [fetchAutomation]);

  const fetchTemplates = useCallback(async () => {
    if (templates.length > 0) return;
    setTemplatesLoading(true);
    try {
      const res = await fetch('/api/content-pipeline/templates?scope=mine');
      const data = await res.json();
      setTemplates(data.templates || []);
    } catch {
      // Silent
    } finally {
      setTemplatesLoading(false);
    }
  }, [templates.length]);

  const handleCreateAutomation = async () => {
    setAutomationSaving(true);
    try {
      const keywords = autoKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
      const body = {
        name: `Auto: ${(post.final_content || post.draft_content || '').substring(0, 30)}...`,
        postId: post.id,
        postSocialId: post.linkedin_post_id,
        keywords,
        dmTemplate: autoDmTemplate || null,
        autoConnect,
        autoLike,
        enableFollowUp: autoFollowUp,
        followUpTemplate: autoFollowUpTemplate || null,
      };

      const res = await fetch('/api/linkedin/automations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        setAutomation(data.automation);
        setShowAutomationSetup(false);
      }
    } catch {
      /* silent */
    } finally {
      setAutomationSaving(false);
    }
  };

  const handleToggleAutomation = async (newStatus: AutomationStatus) => {
    if (!automation) return;
    setAutomationSaving(true);
    try {
      const res = await fetch(`/api/linkedin/automations/${automation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setAutomation(data.automation);
      }
    } catch {
      /* silent */
    } finally {
      setAutomationSaving(false);
    }
  };

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

  const canPublish =
    editContent.trim().length > 0 && ['draft', 'reviewing', 'approved'].includes(post.status);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Post Details"
    >
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-background p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Post Details</h2>
            <StatusBadge status={post.status} />
            <SaveIndicator state={saveState} />
          </div>
          <Button variant="ghost" size="icon-sm" onClick={handleClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Hook Score */}
        {post.hook_score !== null && post.hook_score !== undefined && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Hook Score:</span>
            <Badge
              variant={post.hook_score >= 8 ? 'green' : post.hook_score >= 5 ? 'orange' : 'red'}
            >
              {post.hook_score}/10
            </Badge>
          </div>
        )}

        {/* Template & Style Badges */}
        {(post.template_id || post.style_id) && (
          <div className="mb-4 flex items-center gap-2">
            {post.template_id && <Badge variant="purple">Template applied</Badge>}
            {post.style_id && <Badge variant="blue">Style applied</Badge>}
          </div>
        )}

        {/* Variations Tabs */}
        {post.variations && post.variations.length > 0 && (
          <div className="mb-4 flex gap-2 flex-wrap">
            <Button
              variant={activeVariation === null ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveVariation(null)}
            >
              Original
            </Button>
            {post.variations.map((v: PostVariation, i: number) => (
              <Button
                key={v.id}
                variant={activeVariation === i ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveVariation(i)}
              >
                {v.hook_type || `Variation ${i + 1}`}
              </Button>
            ))}
          </div>
        )}

        {/* Editable textarea — primary, always visible */}
        <div className="mb-4">
          <textarea
            value={editContent}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={handleBlur}
            className="min-h-[60vh] w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Write your post content..."
          />
        </div>

        {/* Action buttons */}
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            variant={showTemplatePicker ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              fetchTemplates();
              setShowTemplatePicker(!showTemplatePicker);
            }}
            title="Insert template"
          >
            <FileText className="h-4 w-4 mr-1.5" />
            Templates
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPolish(post.id)}
            disabled={polishing}
          >
            {polishing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Sparkles className="h-4 w-4 mr-1.5" />
            )}
            Polish
          </Button>
          <Button variant="outline" size="sm" onClick={handleCopy}>
            {copied ? (
              <Check className="h-4 w-4 text-green-500 mr-1.5" />
            ) : (
              <Copy className="h-4 w-4 mr-1.5" />
            )}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSchedule(!showSchedule)}>
            <Calendar className="h-4 w-4 mr-1.5" />
            Schedule
          </Button>
          {canPublish && (
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={publishing}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Linkedin className="h-4 w-4 mr-1.5" />
              )}
              Publish to LinkedIn
            </Button>
          )}
        </div>

        {/* Template Picker */}
        {showTemplatePicker && (
          <div className="mb-4 rounded-lg border bg-card p-3 space-y-2 max-h-48 overflow-y-auto">
            {templatesLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2 text-center">
                No templates yet. Create some in the Library tab.
              </p>
            ) : (
              templates.map((t) => (
                <Button
                  key={t.id}
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const current = editContent.trim();
                    if (current && !confirm('Replace current content with this template?')) return;
                    handleChange(t.structure);
                    setShowTemplatePicker(false);
                  }}
                  className="w-full justify-start text-left"
                >
                  <span className="font-medium">{t.name}</span>
                  {t.category && (
                    <span className="ml-2 text-xs text-muted-foreground">{t.category}</span>
                  )}
                </Button>
              ))
            )}
          </div>
        )}

        {/* LinkedIn Preview (collapsible) */}
        <details className="mb-4">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
            LinkedIn Preview
          </summary>
          <div className="mt-2">
            <PostPreview content={editContent} />
          </div>
        </details>

        {/* DM Template */}
        {post.dm_template && (
          <details className="mb-4">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
              DM Template
            </summary>
            <p className="mt-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              {post.dm_template}
            </p>
          </details>
        )}

        {/* Polish Notes */}
        {post.polish_notes && (
          <details className="mb-4">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">
              Polish Notes
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">{post.polish_notes}</p>
          </details>
        )}

        {/* Engagement Scraping (published posts with LinkedIn ID only) */}
        {isPublishedWithLinkedIn && (
          <div className="mb-4 rounded-lg border bg-muted/50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Engagement Scraping</p>
              {engagementLoading && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
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
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  const enabled = !scrapeEnabled;
                  setScrapeEnabled(enabled);
                  handleEngagementSave({ scrape_engagement: enabled });
                }}
                disabled={engagementSaving}
                aria-label={scrapeEnabled ? 'Disable scraping' : 'Enable scraping'}
              >
                <div
                  className={cn(
                    'w-8 h-4 rounded-full relative transition-colors',
                    scrapeEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
                  )}
                >
                  <div
                    className={cn(
                      'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform',
                      scrapeEnabled ? 'left-4' : 'left-0.5'
                    )}
                  />
                </div>
              </Button>
              <span className="text-sm">Scrape engagement from this post</span>
            </div>

            {/* Campaign ID */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="mb-1 text-xs text-muted-foreground">HeyReach Campaign ID</Label>
                <Input
                  value={campaignId}
                  onChange={(e) => setCampaignId(e.target.value)}
                  placeholder="e.g. 301276"
                />
              </div>
              <Button
                size="sm"
                onClick={() => handleEngagementSave({ heyreach_campaign_id: campaignId })}
                disabled={engagementSaving}
              >
                {engagementSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
          </div>
        )}

        {/* Comment→DM Automation (published posts with LinkedIn ID) */}
        {isPublishedWithLinkedIn && (
          <div className="mb-4 rounded-lg border bg-muted/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">Comment→DM Automation</p>
                {automationLoading && (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </div>
              {automation && (
                <Badge
                  variant={
                    automation.status === 'running'
                      ? 'green'
                      : automation.status === 'paused'
                        ? 'orange'
                        : 'gray'
                  }
                >
                  {automation.status}
                </Badge>
              )}
            </div>

            {automation ? (
              <>
                {/* Automation stats */}
                <div className="mb-3 grid grid-cols-3 gap-2">
                  <div className="rounded-md bg-background px-2 py-1.5 text-center">
                    <p className="text-lg font-semibold">{automation.leads_captured || 0}</p>
                    <p className="text-xs text-muted-foreground">DMs Sent</p>
                  </div>
                  <div className="rounded-md bg-background px-2 py-1.5 text-center">
                    <p className="text-lg font-semibold">{(automation.keywords || []).length}</p>
                    <p className="text-xs text-muted-foreground">Keywords</p>
                  </div>
                  <div className="rounded-md bg-background px-2 py-1.5 text-center">
                    <p className="text-lg font-semibold">{automationEventCount}</p>
                    <p className="text-xs text-muted-foreground">Events</p>
                  </div>
                </div>

                {/* Toggle buttons */}
                <div className="flex gap-2">
                  {automation.status !== 'running' && (
                    <Button
                      size="sm"
                      onClick={() => handleToggleAutomation('running')}
                      disabled={automationSaving}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {automationSaving ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Zap className="h-3 w-3 mr-1" />
                      )}
                      Start
                    </Button>
                  )}
                  {automation.status === 'running' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleAutomation('paused')}
                      disabled={automationSaving}
                      className="border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950"
                    >
                      {automationSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                      Pause
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
                {!showAutomationSetup ? (
                  <Button
                    variant="outline"
                    onClick={() => setShowAutomationSetup(true)}
                    className="w-full border-dashed text-muted-foreground"
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Set up Comment→DM automation for this post
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label className="mb-1 text-xs text-muted-foreground">
                        Trigger Keywords (comma-separated)
                      </Label>
                      <Input
                        value={autoKeywords}
                        onChange={(e) => setAutoKeywords(e.target.value)}
                        placeholder={
                          post.cta_word
                            ? `e.g. ${post.cta_word}, guide, yes, send`
                            : 'e.g. guide, yes, send, interested'
                        }
                      />
                    </div>

                    <div>
                      <Label className="mb-1 text-xs text-muted-foreground">DM Template</Label>
                      <Textarea
                        value={autoDmTemplate}
                        onChange={(e) => setAutoDmTemplate(e.target.value)}
                        rows={3}
                        placeholder="Hey {{name}}! Thanks for your interest..."
                        className="resize-none"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Variables: {'{{name}}'}, {'{{full_name}}'}, {'{{comment}}'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={autoLike}
                          onChange={(e) => setAutoLike(e.target.checked)}
                          className="rounded"
                        />
                        Auto-like comments
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={autoConnect}
                          onChange={(e) => setAutoConnect(e.target.checked)}
                          className="rounded"
                        />
                        Auto-connect
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={autoFollowUp}
                          onChange={(e) => setAutoFollowUp(e.target.checked)}
                          className="rounded"
                        />
                        Follow-up DM
                      </label>
                    </div>

                    {autoFollowUp && (
                      <div>
                        <Label className="mb-1 text-xs text-muted-foreground">
                          Follow-up Template (sent after 24h)
                        </Label>
                        <Textarea
                          value={autoFollowUpTemplate}
                          onChange={(e) => setAutoFollowUpTemplate(e.target.value)}
                          rows={2}
                          placeholder="Hey {{name}}, just following up..."
                          className="resize-none"
                        />
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAutomationSetup(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleCreateAutomation}
                        disabled={automationSaving || !autoKeywords.trim()}
                      >
                        {automationSaving ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Zap className="h-3 w-3 mr-1" />
                        )}
                        Create Automation
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Publish Error */}
        {publishError && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/50">
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
          <div className="mb-4 rounded-lg border bg-muted/50 p-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Label className="mb-1 text-xs">Schedule Time</Label>
                <Input
                  type="datetime-local"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                />
              </div>
              <Button onClick={handleSchedule} disabled={scheduling}>
                {scheduling ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <Send className="h-4 w-4 mr-1.5" />
                )}
                Schedule to LinkedIn
              </Button>
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

      {/* Style Feedback Toast */}
      {feedbackEditId && (
        <StyleFeedbackToast editId={feedbackEditId} onDismiss={() => setFeedbackEditId(null)} />
      )}
    </div>
  );
}

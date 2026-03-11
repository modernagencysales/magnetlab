'use client';

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
import { StyleFeedbackToast } from './StyleFeedbackToast';
import type { PipelinePost, PostVariation } from '@/lib/types/content-pipeline';
import { usePostDetail } from '@/frontend/hooks/usePostDetail';

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
  const {
    activeVariation,
    setActiveVariation,
    editing,
    setEditing,
    editContent,
    setEditContent,
    saving,
    handleSave,
    copied,
    handleCopy,
    scheduling,
    showSchedule,
    setShowSchedule,
    scheduleTime,
    setScheduleTime,
    scheduleError,
    handleSchedule,
    publishing,
    publishError,
    handlePublish,
    canPublish,
    feedbackEditId,
    setFeedbackEditId,
    engagementStats,
    scrapeEnabled,
    setScrapeEnabled,
    campaignId,
    setCampaignId,
    engagementLoading,
    engagementSaving,
    handleEngagementSave,
    automation,
    automationLoading,
    automationSaving,
    showAutomationSetup,
    setShowAutomationSetup,
    autoKeywords,
    setAutoKeywords,
    autoDmTemplate,
    setAutoDmTemplate,
    autoConnect,
    setAutoConnect,
    autoLike,
    setAutoLike,
    autoFollowUp,
    setAutoFollowUp,
    autoFollowUpTemplate,
    setAutoFollowUpTemplate,
    automationEventCount,
    handleCreateAutomation,
    handleToggleAutomation,
    showTemplatePicker,
    setShowTemplatePicker,
    templates,
    templatesLoading,
    fetchTemplates,
    isPublishedWithLinkedIn,
    displayContent,
  } = usePostDetail(post, { onClose, onUpdate });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Post Details"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Post Details</h2>
            <StatusBadge status={post.status} />
          </div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close">
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

        {/* LinkedIn Preview */}
        <div className="mb-4">
          <PostPreview content={displayContent} />
        </div>

        {/* Edit Mode */}
        {editing ? (
          <div className="mb-4 space-y-3">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="h-48 resize-none"
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
          </div>
        ) : null}

        {/* DM Template */}
        {post.dm_template && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground uppercase">DM Template</p>
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              {post.dm_template}
            </p>
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

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
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
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
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
          <div className="mt-3 rounded-lg border bg-card p-3 space-y-2 max-h-48 overflow-y-auto">
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
                    setEditContent(t.structure);
                    setEditing(true);
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

        {/* Publish Error */}
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

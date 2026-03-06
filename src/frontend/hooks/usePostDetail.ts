'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
  PipelinePost,
  PostTemplate,
  LinkedInAutomation,
  AutomationStatus,
} from '@/lib/types/content-pipeline';
import {
  updatePost,
  schedulePost,
  publishPost,
  getPostEngagement,
  updatePostEngagement,
} from '@/frontend/api/content-pipeline/posts';
import * as templatesApi from '@/frontend/api/content-pipeline/templates';
import * as automationsApi from '@/frontend/api/linkedin/automations';

interface UsePostDetailOptions {
  onClose: () => void;
  onUpdate: () => void;
}

export function usePostDetail(post: PipelinePost, { onClose, onUpdate }: UsePostDetailOptions) {
  const isPublishedWithLinkedIn = post.status === 'published' && !!post.linkedin_post_id;

  // Editing
  const [activeVariation, setActiveVariation] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.final_content || post.draft_content || '');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedbackEditId, setFeedbackEditId] = useState<string | null>(null);

  // Schedule
  const [scheduling, setScheduling] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('');
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Publish
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Engagement
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

  // Automation
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

  // Templates
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templates, setTemplates] = useState<
    { id: string; name: string; structure: string; category: string | null }[]
  >([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // Derived
  const displayContent =
    activeVariation !== null && post.variations?.[activeVariation]
      ? post.variations[activeVariation].content
      : post.final_content || post.draft_content || '';

  const canPublish =
    displayContent.trim().length > 0 && ['draft', 'reviewing', 'approved'].includes(post.status);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const fetchEngagementStats = useCallback(async () => {
    if (!isPublishedWithLinkedIn) return;
    setEngagementLoading(true);
    try {
      const data = await getPostEngagement(post.id);
      setEngagementStats(
        (data.stats ?? null) as {
          comments: number;
          reactions: number;
          resolved: number;
          pushed: number;
        } | null
      );
      setScrapeEnabled(data.config?.scrape_engagement ?? false);
      setCampaignId(data.config?.heyreach_campaign_id || '');
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
      await updatePostEngagement(post.id, updates);
      await fetchEngagementStats();
    } catch {
      /* silent */
    } finally {
      setEngagementSaving(false);
    }
  };

  const fetchAutomation = useCallback(async () => {
    if (!isPublishedWithLinkedIn) return;
    setAutomationLoading(true);
    try {
      const data = await automationsApi.listAutomations();
      const existing = (data.automations || []).find(
        (a) => a.post_id === post.id || a.post_social_id === post.linkedin_post_id
      );
      if (existing) {
        setAutomation(existing as LinkedInAutomation);
        setAutoKeywords((existing.keywords || []).join(', '));
        setAutoDmTemplate(existing.dm_template || post.dm_template || '');
        setAutoConnect(existing.auto_connect);
        setAutoLike(existing.auto_like);
        setAutoFollowUp(existing.enable_follow_up);
        setAutoFollowUpTemplate(existing.follow_up_template || '');
        const evtData = await automationsApi.getAutomation(existing.id);
        setAutomationEventCount((evtData.events || []).length);
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
      const list = await templatesApi.listTemplates('mine');
      setTemplates((list || []) as PostTemplate[]);
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
      const data = await automationsApi.createAutomation({
        name: `Auto: ${(post.final_content || post.draft_content || '').substring(0, 30)}...`,
        postId: post.id,
        postSocialId: post.linkedin_post_id || null,
        keywords,
        dmTemplate: autoDmTemplate || null,
        autoConnect,
        autoLike,
        enableFollowUp: autoFollowUp,
        followUpTemplate: autoFollowUpTemplate || null,
      });
      setAutomation(data.automation as LinkedInAutomation);
      setShowAutomationSetup(false);
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
      const data = await automationsApi.updateAutomation(automation.id, { status: newStatus });
      setAutomation(data.automation as LinkedInAutomation);
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
      await schedulePost(post.id, scheduleTime || undefined);
      onUpdate();
      onClose();
    } catch (err) {
      setScheduleError(err instanceof Error ? err.message : 'Failed to schedule');
    } finally {
      setScheduling(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setPublishError(null);
    try {
      await publishPost(post.id);
      onUpdate();
      onClose();
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setPublishing(false);
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
      const data = await updatePost(post.id, { final_content: editContent });
      setEditing(false);
      onUpdate();
      if (data.editId) {
        setFeedbackEditId(data.editId);
      }
    } catch {
      // Silent failure
    } finally {
      setSaving(false);
    }
  };

  return {
    // Variation
    activeVariation,
    setActiveVariation,
    // Editing
    editing,
    setEditing,
    editContent,
    setEditContent,
    saving,
    handleSave,
    // Copy
    copied,
    handleCopy,
    // Schedule
    scheduling,
    showSchedule,
    setShowSchedule,
    scheduleTime,
    setScheduleTime,
    scheduleError,
    handleSchedule,
    // Publish
    publishing,
    publishError,
    handlePublish,
    canPublish,
    // Feedback
    feedbackEditId,
    setFeedbackEditId,
    // Engagement
    engagementStats,
    scrapeEnabled,
    setScrapeEnabled,
    campaignId,
    setCampaignId,
    engagementLoading,
    engagementSaving,
    handleEngagementSave,
    // Automation
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
    // Templates
    showTemplatePicker,
    setShowTemplatePicker,
    templates,
    templatesLoading,
    fetchTemplates,
    // Derived
    isPublishedWithLinkedIn,
    displayContent,
  };
}

// LinkedIn Comment→DM Automation Engine
// Processes incoming comments, matches keywords, sends DMs/connections/likes

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getUnipileClient, getUserPostingAccountId } from '@/lib/integrations/unipile';
import { pushLeadsToHeyReach } from '@/lib/integrations/heyreach/client';
import { logError } from '@/lib/utils/logger';
import type { LinkedInAutomation, AutomationEventType } from '@/lib/types/content-pipeline';

interface CommentEvent {
  postSocialId: string;
  commentText: string;
  commenterName: string;
  commenterProviderId: string;
  commenterLinkedinUrl?: string;
  commentedAt: string;
}

interface ProcessResult {
  automationId: string;
  actions: string[];
  errors: string[];
}

/**
 * Find active automations matching a post's social_id.
 */
export async function findAutomationsForPost(postSocialId: string): Promise<LinkedInAutomation[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('linkedin_automations')
    .select('*')
    .eq('post_social_id', postSocialId)
    .eq('status', 'running');

  if (error) {
    logError('services/linkedin-automation', new Error('Failed to find automations'), { detail: error.message });
    return [];
  }

  return (data || []) as LinkedInAutomation[];
}

/**
 * Check if a comment matches any of the automation's keywords.
 * Case-insensitive, matches if any keyword appears as a word boundary.
 */
export function matchesKeywords(commentText: string, keywords: string[]): boolean {
  if (!keywords || keywords.length === 0) return false;
  const lower = commentText.toLowerCase();
  return keywords.some(kw => {
    const kwLower = kw.toLowerCase().trim();
    if (!kwLower) return false;
    // Match whole word or phrase
    return lower.includes(kwLower);
  });
}

/**
 * Process a single comment against a single automation.
 * Executes all configured actions (DM, like, connect, reply).
 */
export async function processComment(
  automation: LinkedInAutomation,
  comment: CommentEvent
): Promise<ProcessResult> {
  const supabase = createSupabaseAdminClient();
  const actions: string[] = [];
  const errors: string[] = [];

  // Log the comment detection
  await logEvent(automation.id, 'comment_detected', comment);

  // Check keyword match
  if (!matchesKeywords(comment.commentText, automation.keywords)) {
    return { automationId: automation.id, actions: ['no_keyword_match'], errors: [] };
  }

  await logEvent(automation.id, 'keyword_matched', comment);

  // Determine which account to use for Unipile actions (like/reply)
  const accountId = automation.unipile_account_id
    || await getUserPostingAccountId(automation.user_id);

  // 1. Auto-like the comment (via Unipile — low risk)
  if (automation.auto_like && automation.post_social_id && accountId) {
    try {
      const client = getUnipileClient();
      await client.addReaction(automation.post_social_id, accountId, 'LIKE');
      actions.push('like_sent');
      await logEvent(automation.id, 'like_sent', comment);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`like: ${msg}`);
      await logEvent(automation.id, 'like_failed', comment, undefined, msg);
    }
  }

  // 2. Enroll in HeyReach campaign (replaces Unipile DM + connect)
  if (automation.heyreach_campaign_id && comment.commenterLinkedinUrl) {
    try {
      const customVars: Record<string, string> = {};
      if (automation.resource_url) {
        customVars.resource_url = automation.resource_url;
      }

      const result = await pushLeadsToHeyReach(
        automation.heyreach_campaign_id,
        [{
          profileUrl: comment.commenterLinkedinUrl,
          firstName: comment.commenterName.split(' ')[0] || undefined,
          lastName: comment.commenterName.split(' ').slice(1).join(' ') || undefined,
          customVariables: Object.keys(customVars).length > 0 ? customVars : undefined,
        }]
      );

      if (!result.success) throw new Error(result.error || 'HeyReach push failed');
      actions.push('heyreach_enrolled');
      await logEvent(automation.id, 'dm_sent', comment, `HeyReach campaign ${automation.heyreach_campaign_id}`);

      // Increment leads_captured
      await supabase
        .from('linkedin_automations')
        .update({ leads_captured: (automation.leads_captured || 0) + 1 })
        .eq('id', automation.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`heyreach: ${msg}`);
      await logEvent(automation.id, 'dm_failed', comment, undefined, msg);
    }
  }

  // 3. Reply to comment (via Unipile — low risk)
  if (automation.comment_reply_template && automation.post_social_id && accountId) {
    try {
      const client = getUnipileClient();
      const replyText = interpolateTemplate(automation.comment_reply_template, {
        name: comment.commenterName.split(' ')[0] || 'there',
        full_name: comment.commenterName,
        comment: comment.commentText,
      });

      const result = await client.addComment(automation.post_social_id, accountId, replyText);
      if (result.error) {
        throw new Error(result.error);
      }
      actions.push('reply_sent');
      await logEvent(automation.id, 'reply_sent', comment, replyText);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push(`reply: ${msg}`);
      await logEvent(automation.id, 'reply_failed', comment, undefined, msg);
    }
  }

  return { automationId: automation.id, actions, errors };
}

/**
 * Simple template interpolation: replaces {{name}}, {{full_name}}, {{comment}}
 */
function interpolateTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Log an automation event.
 */
async function logEvent(
  automationId: string,
  eventType: AutomationEventType,
  comment: CommentEvent,
  actionDetails?: string,
  error?: string
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  await supabase.from('linkedin_automation_events').insert({
    automation_id: automationId,
    event_type: eventType,
    commenter_name: comment.commenterName,
    commenter_provider_id: comment.commenterProviderId,
    commenter_linkedin_url: comment.commenterLinkedinUrl || null,
    comment_text: comment.commentText,
    action_details: actionDetails || null,
    error: error || null,
  });
}

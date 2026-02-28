/**
 * LinkedIn Service
 * Schedule posts and LinkedIn automations CRUD.
 */

import { logApiError } from '@/lib/api/errors';
import * as linkedinRepo from '@/server/repositories/linkedin.repo';

export async function schedulePost(
  userId: string,
  payload: { leadMagnetId: string; content: string; scheduledTime: string }
) {
  const plan = await linkedinRepo.getSubscriptionPlan(userId);
  if (!plan || plan.plan === 'free') {
    return { success: false, error: 'forbidden' as const, message: 'Scheduling requires an Unlimited subscription' };
  }

  const { data: newPost, error: insertError } = await linkedinRepo.insertScheduledPost({
    userId,
    finalContent: payload.content,
    scheduledTime: payload.scheduledTime,
    leadMagnetId: payload.leadMagnetId,
  });

  if (insertError) {
    logApiError('linkedin/schedule/insert', insertError, { leadMagnetId: payload.leadMagnetId });
    return { success: false, error: 'database' as const, message: 'Failed to create scheduled post' };
  }

  const { error: updateError } = await linkedinRepo.updateLeadMagnetScheduled(
    payload.leadMagnetId,
    userId,
    payload.scheduledTime
  );
  if (updateError) {
    logApiError('linkedin/schedule/db-update', updateError, { leadMagnetId: payload.leadMagnetId });
  }

  await linkedinRepo.incrementUsage(userId, 'posts');

  return {
    success: true,
    postId: newPost!.id,
    scheduledTime: payload.scheduledTime,
    scheduled_via: 'pending',
  };
}

export async function listAutomations(userId: string) {
  const { data, error } = await linkedinRepo.listLinkedInAutomations(userId);
  if (error) {
    logApiError('linkedin/automations/list', error);
    return { success: false, error: 'database' as const };
  }
  return { success: true, automations: data };
}

export async function createAutomation(userId: string, payload: Record<string, unknown>) {
  const name = (payload.name as string)?.trim();
  if (!name) {
    return { success: false, error: 'validation' as const, message: 'Name is required' };
  }

  const { data, error } = await linkedinRepo.createLinkedInAutomation(userId, {
    name,
    postId: payload.postId as string | undefined,
    postSocialId: payload.postSocialId as string | undefined,
    keywords: payload.keywords as string[] | undefined,
    dmTemplate: payload.dmTemplate as string | undefined,
    autoConnect: payload.autoConnect as boolean | undefined,
    autoLike: payload.autoLike as boolean | undefined,
    commentReplyTemplate: payload.commentReplyTemplate as string | undefined,
    enableFollowUp: payload.enableFollowUp as boolean | undefined,
    followUpTemplate: payload.followUpTemplate as string | undefined,
    followUpDelayMinutes: payload.followUpDelayMinutes as number | undefined,
    unipileAccountId: payload.unipileAccountId as string | undefined,
    heyreachCampaignId: payload.heyreachCampaignId as string | undefined,
    resourceUrl: payload.resourceUrl as string | undefined,
  });

  if (error) {
    logApiError('linkedin/automations/create', error);
    return { success: false, error: 'database' as const };
  }
  return { success: true, automation: data };
}

export async function getAutomation(userId: string, id: string) {
  const { data: automation, error } = await linkedinRepo.getLinkedInAutomation(id, userId);
  if (error || !automation) {
    return { success: false, error: 'not_found' as const };
  }
  const { data: events } = await linkedinRepo.getLinkedInAutomationEvents(id, 50);
  return { success: true, automation, events: events ?? [] };
}

const VALID_STATUSES = ['draft', 'running', 'paused'];

export async function updateAutomation(userId: string, id: string, body: Record<string, unknown>) {
  const allowedFields = [
    'name', 'postSocialId', 'keywords', 'dmTemplate',
    'autoConnect', 'autoLike', 'commentReplyTemplate',
    'enableFollowUp', 'followUpTemplate', 'followUpDelayMinutes',
    'status', 'unipileAccountId', 'heyreachCampaignId', 'resourceUrl',
  ];
  const updates: Record<string, unknown> = {};
  for (const field of allowedFields) {
    const snake = field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    if (body[field] !== undefined) updates[snake] = body[field];
    else if (body[snake] !== undefined) updates[snake] = body[snake];
  }
  if (updates.status && !VALID_STATUSES.includes(updates.status as string)) {
    return { success: false, error: 'validation' as const, message: `Status must be one of: ${VALID_STATUSES.join(', ')}` };
  }
  if (Object.keys(updates).length === 0) {
    return { success: false, error: 'validation' as const, message: 'No valid fields to update' };
  }

  const { data, error } = await linkedinRepo.updateLinkedInAutomation(id, userId, updates);
  if (error || !data) {
    logApiError('linkedin/automations/update', error);
    return { success: false, error: 'not_found' as const };
  }
  return { success: true, automation: data };
}

export async function deleteAutomation(userId: string, id: string) {
  const { error } = await linkedinRepo.deleteLinkedInAutomation(id, userId);
  if (error) {
    logApiError('linkedin/automations/delete', error);
    return { success: false, error: 'database' as const };
  }
  return { success: true };
}

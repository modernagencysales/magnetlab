/**
 * Email Service
 * Broadcasts, flows, flow steps, subscribers, generate-daily, unsubscribe.
 * Uses email.repo for all DB access; no Supabase in route layer.
 */

import { tasks } from '@trigger.dev/sdk/v3';
import { writeNewsletterEmail } from '@/lib/ai/content-pipeline/email-writer';
import { buildContentBrief } from '@/lib/ai/content-pipeline/briefing-agent';
import { generateEmailSequence, generateDefaultEmailSequence } from '@/lib/ai/email-sequence-generator';
import { captureAndClassifyEdit } from '@/lib/services/edit-capture';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logApiError } from '@/lib/api/errors';
import type { EmailGenerationContext } from '@/lib/types/email';
import type { AudienceFilter } from '@/lib/types/email-system';
import * as emailRepo from '@/server/repositories/email.repo';

// ─── Broadcasts ─────────────────────────────────────────────────────────────

export async function listBroadcasts(teamId: string) {
  try {
    const data = await emailRepo.findBroadcasts(teamId);
    return { success: true as const, broadcasts: data };
  } catch (error) {
    logApiError('email/broadcasts/list', error, { teamId });
    return { success: false as const, error: 'database' as const };
  }
}

export async function createBroadcast(
  teamId: string,
  userId: string,
  payload: { subject?: string; body?: string }
) {
  try {
    const broadcast = await emailRepo.createBroadcast(
      teamId,
      userId,
      payload.subject ?? '',
      payload.body ?? ''
    );
    return { success: true as const, broadcast };
  } catch (error) {
    logApiError('email/broadcasts/create', error, { teamId });
    return { success: false as const, error: 'database' as const };
  }
}

export async function getBroadcast(teamId: string, id: string) {
  try {
    const broadcast = await emailRepo.findBroadcastById(teamId, id);
    if (!broadcast) return { success: false as const, error: 'not_found' as const };
    return { success: true as const, broadcast };
  } catch (error) {
    logApiError('email/broadcasts/get', error, { id, teamId });
    return { success: false as const, error: 'database' as const };
  }
}

export async function updateBroadcast(
  teamId: string,
  id: string,
  payload: { subject?: string; body?: string; audience_filter?: AudienceFilter | null },
  options?: { captureEdits?: boolean }
) {
  try {
    const existing = await emailRepo.findBroadcastForEdit(teamId, id);
    if (!existing) return { success: false as const, error: 'not_found' as const };
    if (existing.status !== 'draft') {
      return { success: false as const, error: 'validation' as const, message: 'Only draft broadcasts can be updated' };
    }

    const updates: Record<string, unknown> = {};
    if (payload.subject !== undefined) updates.subject = payload.subject;
    if (payload.body !== undefined) updates.body = payload.body;
    if (payload.audience_filter !== undefined) updates.audience_filter = payload.audience_filter;
    if (Object.keys(updates).length === 0) {
      return { success: false as const, error: 'validation' as const, message: 'No valid fields to update' };
    }

    const broadcast = await emailRepo.updateBroadcastById(teamId, id, updates);

    if (options?.captureEdits) {
      const supabase = createSupabaseAdminClient();
      if (payload.subject !== undefined && existing.subject !== undefined && existing.subject !== null) {
        captureAndClassifyEdit(supabase, {
          teamId,
          profileId: null,
          contentType: 'email',
          contentId: id,
          fieldName: 'subject',
          originalText: existing.subject,
          editedText: payload.subject,
        }).catch(() => {});
      }
      if (payload.body !== undefined && existing.body !== undefined && existing.body !== null) {
        captureAndClassifyEdit(supabase, {
          teamId,
          profileId: null,
          contentType: 'email',
          contentId: id,
          fieldName: 'body',
          originalText: existing.body,
          editedText: payload.body,
        }).catch(() => {});
      }
    }

    return { success: true as const, broadcast };
  } catch (error) {
    logApiError('email/broadcasts/update', error, { id, teamId });
    return { success: false as const, error: 'database' as const };
  }
}

export async function deleteBroadcast(teamId: string, id: string) {
  try {
    const existing = await emailRepo.findBroadcastForEdit(teamId, id);
    if (!existing) return { success: false as const, error: 'not_found' as const };
    if (existing.status !== 'draft') {
      return { success: false as const, error: 'validation' as const, message: 'Only draft broadcasts can be deleted' };
    }
    await emailRepo.deleteBroadcastById(teamId, id);
    return { success: true as const };
  } catch (error) {
    logApiError('email/broadcasts/delete', error, { id, teamId });
    return { success: false as const, error: 'database' as const };
  }
}

export async function sendBroadcast(teamId: string, id: string, userId: string) {
  try {
    const broadcast = await emailRepo.findBroadcastForSend(teamId, id);
    if (!broadcast) return { success: false as const, error: 'not_found' as const };
    if (broadcast.status !== 'draft') {
      return { success: false as const, error: 'validation' as const, message: 'Only draft broadcasts can be sent' };
    }
    if (!broadcast.subject?.trim()) {
      return { success: false as const, error: 'validation' as const, message: 'Broadcast must have a subject before sending' };
    }
    if (!broadcast.body?.trim()) {
      return { success: false as const, error: 'validation' as const, message: 'Broadcast must have a body before sending' };
    }

    const recipientCount = await emailRepo.getFilteredSubscriberCount(teamId, broadcast.audience_filter ?? {});
    if (recipientCount === 0) {
      return { success: false as const, error: 'validation' as const, message: 'No subscribers match the audience filter' };
    }

    await emailRepo.markBroadcastSending(teamId, id, recipientCount);
    await tasks.trigger('send-broadcast', {
      broadcast_id: id,
      team_id: teamId,
      user_id: userId,
    });
    return { success: true as const, recipient_count: recipientCount };
  } catch (error) {
    logApiError('email/broadcasts/send', error, { id, teamId });
    return { success: false as const, error: 'database' as const };
  }
}

export async function getBroadcastPreviewCount(teamId: string, id: string) {
  try {
    const broadcast = await emailRepo.findBroadcastById(teamId, id);
    if (!broadcast) return { success: false as const, error: 'not_found' as const };
    const [filtered, total] = await Promise.all([
      emailRepo.getFilteredSubscriberCount(teamId, broadcast.audience_filter ?? {}),
      emailRepo.getFilteredSubscriberCount(teamId, {}),
    ]);
    return { success: true as const, count: filtered, total };
  } catch (error) {
    logApiError('email/broadcasts/preview-count', error, { id, teamId });
    return { success: false as const, error: 'database' as const };
  }
}

// ─── Flows ──────────────────────────────────────────────────────────────────

export async function listFlows(teamId: string) {
  try {
    const flows = await emailRepo.findFlows(teamId);
    if (flows.length === 0) return { success: true as const, flows: [] };
    const flowIds = flows.map((f: { id: string }) => f.id);
    const stepCountRows = await emailRepo.findFlowStepCountRows(flowIds);
    const countMap = new Map<string, number>();
    for (const row of stepCountRows) {
      const fid = (row as { flow_id: string }).flow_id;
      countMap.set(fid, (countMap.get(fid) ?? 0) + 1);
    }
    const flowsWithCounts = flows.map((f: Record<string, unknown>) => ({
      ...f,
      step_count: countMap.get(f.id as string) ?? 0,
    }));
    return { success: true as const, flows: flowsWithCounts };
  } catch (error) {
    logApiError('email/flows/list', error, { teamId });
    return { success: false as const, error: 'database' as const };
  }
}

export async function createFlow(
  teamId: string,
  userId: string,
  payload: {
    name: string;
    description?: string | null;
    trigger_type: string;
    trigger_lead_magnet_id?: string | null;
  }
) {
  try {
    if (payload.trigger_type === 'lead_magnet' && payload.trigger_lead_magnet_id) {
      const lm = await emailRepo.findLeadMagnetByOwnerForFlow(userId, payload.trigger_lead_magnet_id);
      if (!lm) {
        return { success: false as const, error: 'validation' as const, message: 'Lead magnet not found or does not belong to you' };
      }
    }
    const flow = await emailRepo.createFlow(teamId, userId, payload);
    return { success: true as const, flow };
  } catch (error) {
    logApiError('email/flows/create', error, { teamId });
    return { success: false as const, error: 'database' as const };
  }
}

export async function getFlowWithSteps(teamId: string, id: string) {
  try {
    const result = await emailRepo.findFlowWithSteps(teamId, id);
    if (!result) return { success: false as const, error: 'not_found' as const };
    return { success: true as const, flow: { ...result.flow, steps: result.steps } };
  } catch (error) {
    logApiError('email/flows/get', error, { id, teamId });
    return { success: false as const, error: 'database' as const };
  }
}

export async function updateFlow(
  teamId: string,
  id: string,
  userId: string,
  updates: Record<string, unknown>
) {
  try {
    const existing = await emailRepo.findFlowForOp(teamId, id);
    if (!existing) return { success: false as const, error: 'not_found' as const };

    if (updates.status === 'active') {
      const count = await emailRepo.countFlowSteps(id);
      if (count === 0) {
        return { success: false as const, error: 'validation' as const, message: 'Flow must have at least 1 step before activating' };
      }
    }

    const effectiveTriggerType = (updates.trigger_type as string) ?? existing.trigger_type;
    if (effectiveTriggerType === 'lead_magnet') {
      if (updates.trigger_type === 'lead_magnet' && !updates.trigger_lead_magnet_id) {
        return { success: false as const, error: 'validation' as const, message: 'trigger_lead_magnet_id is required when trigger_type is lead_magnet' };
      }
      const lmId = updates.trigger_lead_magnet_id as string | undefined;
      if (lmId) {
        const lm = await emailRepo.findLeadMagnetByOwnerForFlow(userId, lmId);
        if (!lm) {
          return { success: false as const, error: 'validation' as const, message: 'Lead magnet not found or does not belong to you' };
        }
      }
    }

    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.trigger_type !== undefined) updateData.trigger_type = updates.trigger_type;
    if (updates.trigger_lead_magnet_id !== undefined) updateData.trigger_lead_magnet_id = updates.trigger_lead_magnet_id;
    if (Object.keys(updateData).length === 0) {
      return { success: false as const, error: 'validation' as const, message: 'No fields to update' };
    }

    const flow = await emailRepo.updateFlowById(teamId, id, updateData);
    return { success: true as const, flow };
  } catch (error) {
    logApiError('email/flows/update', error, { id, teamId });
    return { success: false as const, error: 'database' as const };
  }
}

export async function deleteFlow(teamId: string, id: string) {
  try {
    const flow = await emailRepo.findFlowForOp(teamId, id);
    if (!flow) return { success: false as const, error: 'not_found' as const };
    if (flow.status !== 'draft' && flow.status !== 'paused') {
      return { success: false as const, error: 'validation' as const, message: 'Only draft or paused flows can be deleted' };
    }
    await emailRepo.deleteFlowById(id);
    return { success: true as const };
  } catch (error) {
    logApiError('email/flows/delete', error, { id, teamId });
    return { success: false as const, error: 'database' as const };
  }
}

export async function generateFlowSteps(
  teamId: string,
  flowId: string,
  userId: string,
  stepCount: number
) {
  try {
    const flow = await emailRepo.findFlowForGenerate(teamId, flowId);
    if (!flow) return { success: false as const, error: 'not_found' as const };

    let leadMagnetTitle = flow.name;
    let leadMagnetFormat = 'guide';
    let leadMagnetContents = (flow.description as string) ?? '';

    if (flow.trigger_type === 'lead_magnet' && flow.trigger_lead_magnet_id) {
      const lm = await emailRepo.findLeadMagnetForEmail(userId, flow.trigger_lead_magnet_id);
      if (lm) {
        leadMagnetTitle = lm.title;
        const concept = lm.concept as { contents?: string; deliveryFormat?: string } | null;
        const extracted = lm.extracted_content as { title?: string; format?: string } | null;
        leadMagnetFormat = extracted?.format ?? (concept?.deliveryFormat as string) ?? lm.archetype ?? 'guide';
        leadMagnetContents = (concept?.contents as string) ?? (extracted?.title as string) ?? '';
      }
    }

    const brandKit = await emailRepo.findBrandKitBasic(userId);
    const senderName = brandKit?.sender_name ?? (await emailRepo.findUserDisplayName(userId)) ?? 'Your Friend';

    const context: EmailGenerationContext = {
      leadMagnetTitle,
      leadMagnetFormat,
      leadMagnetContents,
      senderName,
      businessDescription: (brandKit?.business_description as string) ?? '',
      bestVideoUrl: brandKit?.best_video_url as string | undefined,
      bestVideoTitle: brandKit?.best_video_title as string | undefined,
      contentLinks: brandKit?.content_links as Array<{ title: string; url: string }> | undefined,
      communityUrl: brandKit?.community_url as string | undefined,
      audienceStyle: 'casual-direct',
    };

    let emails;
    try {
      emails = await generateEmailSequence({ context });
    } catch (aiError) {
      logApiError('email/flows/generate/ai', aiError, { flowId, note: 'Falling back to default' });
      emails = generateDefaultEmailSequence(leadMagnetTitle, senderName);
    }

    const emailsToUse = emails.slice(0, stepCount);
    const stepsData = emailsToUse.map((email, index) => ({
      flow_id: flowId,
      step_number: index,
      subject: email.subject,
      body: email.body,
      delay_days: email.day,
    }));

    const steps = await emailRepo.replaceFlowSteps(flowId, stepsData);
    return { success: true as const, steps, generated: true, stepCount: steps.length };
  } catch (error) {
    logApiError('email/flows/generate', error, { flowId, teamId });
    return { success: false as const, error: 'database' as const };
  }
}

export async function listFlowContacts(teamId: string, flowId: string, page: number, limit: number) {
  try {
    const ok = await emailRepo.verifyFlowOwnership(teamId, flowId);
    if (!ok) return { success: false as const, error: 'not_found' as const };
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const { data, count } = await emailRepo.findFlowContactsPaginated(flowId, from, to);
    const contacts = data.map((c: Record<string, unknown>) => {
      const subscriber = c.email_subscribers as { email: string; first_name: string | null; last_name: string | null } | null;
      return {
        id: c.id,
        flow_id: c.flow_id,
        subscriber_id: c.subscriber_id,
        current_step: c.current_step,
        status: c.status,
        entered_at: c.entered_at,
        last_sent_at: c.last_sent_at,
        email: subscriber?.email ?? null,
        first_name: subscriber?.first_name ?? null,
        last_name: subscriber?.last_name ?? null,
      };
    });
    return { success: true as const, contacts, total: count ?? 0, page, limit };
  } catch (error) {
    logApiError('email/flows/contacts/list', error, { flowId, teamId });
    return { success: false as const, error: 'database' as const };
  }
}

export async function addFlowStep(
  teamId: string,
  flowId: string,
  payload: { step_number: number; subject: string; body: string; delay_days: number }
) {
  try {
    const flow = await emailRepo.findFlowForStepOp(teamId, flowId);
    if (!flow) return { success: false as const, error: 'not_found' as const };
    if (flow.status !== 'draft' && flow.status !== 'paused') {
      return { success: false as const, error: 'validation' as const, message: 'Steps can only be added to draft or paused flows' };
    }
    const step = await emailRepo.insertFlowStep(flowId, payload);
    return { success: true as const, step };
  } catch (error) {
    logApiError('email/flows/steps/create', error, { flowId, teamId });
    return { success: false as const, error: 'database' as const };
  }
}

export async function updateFlowStep(
  teamId: string,
  flowId: string,
  stepId: string,
  updates: Record<string, unknown>
) {
  try {
    const flow = await emailRepo.findFlowForStepOp(teamId, flowId);
    if (!flow) return { success: false as const, error: 'not_found' as const };
    if (flow.status !== 'draft' && flow.status !== 'paused') {
      return { success: false as const, error: 'validation' as const, message: 'Steps can only be updated in draft or paused flows' };
    }
    const existingStep = await emailRepo.findFlowStep(flowId, stepId);
    if (!existingStep) return { success: false as const, error: 'not_found' as const };

    const updateData: Record<string, unknown> = {};
    if (updates.subject !== undefined) updateData.subject = updates.subject;
    if (updates.body !== undefined) updateData.body = updates.body;
    if (updates.delay_days !== undefined) updateData.delay_days = updates.delay_days;
    if (updates.step_number !== undefined) updateData.step_number = updates.step_number;
    if (Object.keys(updateData).length === 0) {
      return { success: false as const, error: 'validation' as const, message: 'No fields to update' };
    }

    const step = await emailRepo.updateFlowStepById(flowId, stepId, updateData);
    return { success: true as const, step };
  } catch (error) {
    logApiError('email/flows/steps/update', error, { flowId, stepId, teamId });
    return { success: false as const, error: 'database' as const };
  }
}

export async function deleteFlowStep(teamId: string, flowId: string, stepId: string) {
  try {
    const flow = await emailRepo.findFlowForStepOp(teamId, flowId);
    if (!flow) return { success: false as const, error: 'not_found' as const };
    if (flow.status !== 'draft' && flow.status !== 'paused') {
      return { success: false as const, error: 'validation' as const, message: 'Steps can only be removed from draft or paused flows' };
    }
    const stepToDelete = await emailRepo.findFlowStep(flowId, stepId);
    if (!stepToDelete) return { success: false as const, error: 'not_found' as const };
    const deletedStepNumber = stepToDelete.step_number;

    await emailRepo.deleteFlowStepById(stepId);
    await emailRepo.renumberStepsAfter(flowId, deletedStepNumber);
    return { success: true as const };
  } catch (error) {
    logApiError('email/flows/steps/delete', error, { flowId, stepId, teamId });
    return { success: false as const, error: 'database' as const };
  }
}

// ─── Subscribers ────────────────────────────────────────────────────────────

export async function listSubscribers(
  teamId: string,
  opts: { search: string; status: string | null; source: string | null; page: number; limit: number }
) {
  try {
    const from = (opts.page - 1) * opts.limit;
    const to = from + opts.limit - 1;
    const { data, count } = await emailRepo.findSubscribersPaginated(teamId, {
      search: opts.search,
      status: opts.status,
      source: opts.source,
      from,
      to,
    });
    return { success: true as const, subscribers: data, total: count ?? 0, page: opts.page, limit: opts.limit };
  } catch (error) {
    logApiError('email/subscribers/list', error, { teamId });
    return { success: false as const, error: 'database' as const };
  }
}

export async function createSubscriber(
  teamId: string,
  payload: { email: string; first_name?: string | null; last_name?: string | null }
) {
  try {
    const existing = await emailRepo.findSubscriberByEmail(teamId, payload.email);
    const upsertData: Record<string, unknown> = {
      email: payload.email,
      source: 'manual',
      status: 'active',
    };
    if (existing) {
      upsertData.first_name = payload.first_name ?? existing.first_name ?? null;
      upsertData.last_name = payload.last_name ?? existing.last_name ?? null;
    } else {
      upsertData.first_name = payload.first_name ?? null;
      upsertData.last_name = payload.last_name ?? null;
    }
    const subscriber = await emailRepo.upsertSubscriberRecord(teamId, upsertData);
    return { success: true as const, subscriber };
  } catch (error) {
    logApiError('email/subscribers/create', error, { teamId, email: payload.email });
    return { success: false as const, error: 'database' as const };
  }
}

export async function unsubscribeSubscriberById(teamId: string, id: string) {
  try {
    const subscriber = await emailRepo.findSubscriberByIdAndTeam(teamId, id);
    if (!subscriber) return { success: false as const, error: 'not_found' as const };
    if (subscriber.status === 'unsubscribed') {
      return { success: true as const, already: true as const };
    }
    await emailRepo.softUnsubscribeSubscriber(teamId, id);
    await emailRepo.deactivateSubscriberFlowContacts(id, teamId);
    return { success: true as const, already: false as const };
  } catch (error) {
    logApiError('email/subscribers/delete', error, { id, teamId });
    return { success: false as const, error: 'database' as const };
  }
}

export async function importSubscribers(
  teamId: string,
  validRows: Array<{ email: string; first_name: string | null; last_name: string | null }>
) {
  try {
    if (validRows.length === 0) return { success: true as const, imported: 0, skipped: 0 };
    const existing = await emailRepo.findSubscribersByEmails(teamId, validRows.map((r) => r.email));
    const existingByEmail = new Map(existing.map((s) => [s.email, { first_name: s.first_name, last_name: s.last_name }]));
    const rows = validRows.map((row) => ({
      team_id: teamId,
      email: row.email,
      first_name: row.first_name ?? existingByEmail.get(row.email)?.first_name ?? null,
      last_name: row.last_name ?? existingByEmail.get(row.email)?.last_name ?? null,
      source: 'import' as const,
      status: 'active' as const,
    }));
    const BATCH_SIZE = 500;
    let imported = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      imported += await emailRepo.bulkUpsertSubscribers(batch);
    }
    return { success: true as const, imported, skipped: 0 };
  } catch (error) {
    logApiError('email/subscribers/import', error, { teamId });
    return { success: false as const, error: 'database' as const };
  }
}

// ─── Generate daily ────────────────────────────────────────────────────────

export async function generateDaily(
  userId: string,
  teamId: string,
  opts: { topic?: string; profileId?: string }
) {
  try {
    const profile = await emailRepo.findTeamProfile(teamId, opts.profileId);
    const voiceProfile = profile?.voice_profile ?? null;
    const authorName = profile?.full_name ?? undefined;

    let topic = opts.topic;
    let todaysLinkedInTopic: string | undefined;
    if (!topic) {
      const todaysContent = await emailRepo.findTodayApprovedPost(userId);
      if (todaysContent) {
        todaysLinkedInTopic = todaysContent.split('\n')[0]?.slice(0, 200);
        topic = todaysLinkedInTopic;
      }
    }
    if (!topic) topic = 'B2B growth strategies and practical business advice';

    const brief = await buildContentBrief(userId, topic, {
      teamId,
      profileId: profile?.id,
      voiceProfile: voiceProfile ?? undefined,
    });

    const emailResult = await writeNewsletterEmail({
      topic,
      knowledgeContext: brief.compiledContext || 'No specific knowledge context available.',
      voiceProfile,
      todaysLinkedInTopic,
      authorName,
    });

    const broadcast = await emailRepo.createBroadcastDraft(
      teamId,
      userId,
      emailResult.subject,
      emailResult.body
    );
    return { success: true as const, broadcast };
  } catch (error) {
    logApiError('email/generate-daily', error, { teamId });
    return { success: false as const, error: 'database' as const };
  }
}

// ─── Unsubscribe (public — token-verified, no auth) ────────────────────────────

export async function unsubscribeByToken(sid: string) {
  try {
    await emailRepo.unsubscribeSubscriberById(sid);
    await emailRepo.deactivateFlowContactsBySid(sid);
    return { success: true as const };
  } catch (error) {
    logApiError('email/unsubscribe', error, { sid });
    return { success: false as const, error: 'database' as const };
  }
}

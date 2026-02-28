/**
 * Webhooks Incoming Service
 * Handles incoming webhook payloads (transcript, resend, attio, etc.).
 * All DB access via repos; no Supabase in route.
 */

import { tasks } from '@trigger.dev/sdk/v3';
import type { processTranscript } from '@/trigger/process-transcript';
import { logError, logInfo, logWarn } from '@/lib/utils/logger';
import * as cpTranscriptsRepo from '@/server/repositories/cp-transcripts.repo';
import * as publicRepo from '@/server/repositories/public.repo';
import * as integrationsRepo from '@/server/repositories/integrations.repo';
import * as leadMagnetsRepo from '@/server/repositories/lead-magnets.repo';
import * as emailRepo from '@/server/repositories/email.repo';

const RESEND_EVENT_TYPE_MAP: Record<string, string> = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

export interface UniversalTranscriptPayload {
  source?: string;
  recording_id: string;
  title?: string;
  date?: string;
  duration_minutes?: number;
  participants?: string[];
  transcript: string;
}

/** Handle universal transcript webhook: dedupe by external_id, insert, trigger process. */
export async function handleTranscript(userId: string, payload: UniversalTranscriptPayload) {
  const source = payload.source || 'other';
  const externalId = `${source}:${payload.recording_id}`;

  const existing = await cpTranscriptsRepo.findTranscriptByExternalIdAndUser(externalId, userId);
  if (existing) {
    return { success: true, duplicate: true, transcript_id: existing.id };
  }

  const { data: transcript, error: insertError } = await cpTranscriptsRepo.insertTranscriptFromWebhook({
    user_id: userId,
    source,
    external_id: externalId,
    title: payload.title ?? null,
    call_date: payload.date ?? null,
    duration_minutes: payload.duration_minutes ?? null,
    participants: payload.participants ?? null,
    raw_transcript: payload.transcript,
  });

  if (insertError || !transcript) {
    logError('webhooks/transcript', new Error(String(insertError?.message)), { step: 'failed_to_insert_transcript' });
    return { success: false, error: 'Failed to save transcript' };
  }

  try {
    await tasks.trigger<typeof processTranscript>('process-transcript', {
      userId,
      transcriptId: transcript.id,
    });
  } catch (triggerError) {
    logWarn('webhooks/transcript', 'Failed to trigger process-transcript', { detail: String(triggerError) });
  }

  return { success: true, transcript_id: transcript.id };
}

/** Handle Grain webhook (same as transcript with source=grain). */
export async function handleGrain(payload: {
  recording_id: string;
  user_id: string;
  transcript: string;
  title?: string;
  date?: string;
  duration_minutes?: number;
  participants?: string[];
}) {
  return handleTranscript(payload.user_id, {
    recording_id: payload.recording_id,
    transcript: payload.transcript,
    title: payload.title,
    date: payload.date,
    duration_minutes: payload.duration_minutes,
    participants: payload.participants,
    source: 'grain',
  });
}

/** Handle Fireflies webhook (same as transcript with source=fireflies, meeting_id as recording_id). */
export async function handleFireflies(payload: {
  meeting_id: string;
  user_id: string;
  transcript: string;
  title?: string;
  date?: string;
  duration_minutes?: number;
  participants?: string[];
}) {
  return handleTranscript(payload.user_id, {
    recording_id: payload.meeting_id,
    transcript: payload.transcript,
    title: payload.title,
    date: payload.date,
    duration_minutes: payload.duration_minutes,
    participants: payload.participants,
    source: 'fireflies',
  });
}

/** Handle Resend email events webhook. */
export async function handleResend(payload: {
  type: string;
  data: {
    email_id?: string;
    to?: string[];
    subject?: string;
    bounce?: { type?: string; message?: string };
    click?: { link?: string; timestamp?: string };
    [key: string]: unknown;
  };
}) {
  const eventType = RESEND_EVENT_TYPE_MAP[payload.type];
  if (!eventType) {
    logInfo('webhooks/resend', `Ignoring unknown event type: ${payload.type}`);
    return { received: true };
  }

  const emailId = payload.data?.email_id;
  const recipients = payload.data?.to || [];
  const subject = payload.data?.subject ?? null;

  if (!emailId || recipients.length === 0) {
    logWarn('webhooks/resend', 'Missing email_id or recipients', {
      type: payload.type,
      emailId,
      recipientCount: recipients.length,
    });
    return { received: true };
  }

  for (const recipientEmail of recipients) {
    const lead = await publicRepo.findLeadByEmailForWebhook(recipientEmail);
    if (!lead) {
      logInfo('webhooks/resend', `No matching lead for ${recipientEmail}, skipping`, {
        emailId,
        eventType,
      });
      continue;
    }

    let linkUrl: string | null = null;
    let bounceType: string | null = null;
    if (eventType === 'clicked' && payload.data?.click?.link) linkUrl = payload.data.click.link;
    if (eventType === 'bounced' && payload.data?.bounce?.type) bounceType = payload.data.bounce.type;

    const insertResult = await publicRepo.insertEmailEvent({
      email_id: emailId,
      lead_id: lead.id,
      lead_magnet_id: lead.lead_magnet_id ?? null,
      user_id: lead.user_id,
      event_type: eventType,
      recipient_email: recipientEmail,
      subject,
      link_url: linkUrl,
      bounce_type: bounceType,
      metadata: (payload.data || {}) as Record<string, unknown>,
    });

    if (insertResult.error) {
      logError('webhooks/resend', new Error(String(insertResult.error?.message)), {
        step: 'insert_email_event',
        emailId,
        eventType,
        recipientEmail,
      });
    }
  }

  return { received: true };
}

/** Handle Attio webhook: dedupe then trigger import task. */
export async function handleAttio(event: {
  event_type: string;
  id: { meeting_id: string; call_recording_id: string };
}) {
  if (event.event_type !== 'call-recording.created') {
    return { success: true, skipped: true };
  }
  const userId = process.env.ATTIO_DEFAULT_USER_ID;
  if (!userId) {
    return { success: false, error: 'ATTIO_DEFAULT_USER_ID not configured' };
  }
  const { call_recording_id, meeting_id } = event.id;
  const externalId = `attio:${call_recording_id}`;
  const existing = await cpTranscriptsRepo.findTranscriptByExternalIdAndUser(externalId, userId);
  if (existing) {
    return { success: true, duplicate: true, transcript_id: existing.id };
  }
  await tasks.trigger('import-attio-recording', {
    meetingId: meeting_id,
    callRecordingId: call_recording_id,
    userId,
  });
  return { success: true, accepted: true };
}

/** Handle Fathom webhook: verify secret then transcript flow. */
export async function handleFathom(
  userId: string,
  secret: string,
  payload: {
    call_id?: string;
    id?: string;
    meeting_id?: string;
    title?: string;
    date?: string;
    duration?: number;
    duration_minutes?: number;
    participants?: string[];
    transcript?: string;
    transcript_text?: string;
  }
) {
  const integration = await integrationsRepo.getFathomIntegration(userId);
  if (!integration || secret !== integration.webhook_secret) {
    return { success: false, error: 'Unauthorized' };
  }
  const meetingId = payload.call_id || payload.id || payload.meeting_id;
  const transcriptText = payload.transcript || payload.transcript_text;
  if (!meetingId || !transcriptText) {
    return { success: false, error: 'Missing required fields: meeting ID and transcript' };
  }
  if (transcriptText.length < 100) {
    return { success: true, skipped: true, reason: 'Transcript too short (< 100 chars)' };
  }
  let durationMinutes: number | null = null;
  if (payload.duration_minutes) durationMinutes = payload.duration_minutes;
  else if (payload.duration) durationMinutes = Math.round(payload.duration / 60);

  return handleTranscript(userId, {
    recording_id: String(meetingId),
    transcript: transcriptText,
    title: payload.title,
    date: payload.date,
    duration_minutes: durationMinutes ?? undefined,
    participants: payload.participants,
    source: 'fathom',
  });
}

/** Handle GTM callback: update lead_magnet status/scheduled_time. */
export async function handleGtmCallback(payload: {
  event: string;
  data: { leadMagnetId?: string; scheduledTime?: string; reason?: string };
}) {
  if (payload.event === 'lead_magnet.scheduled') {
    const { leadMagnetId, scheduledTime } = payload.data;
    if (!leadMagnetId) return { success: false, error: 'Missing leadMagnetId' };
    const { error } = await leadMagnetsRepo.updateLeadMagnetByIdUnscoped(leadMagnetId, {
      scheduled_time: scheduledTime ?? null,
      status: 'scheduled',
      updated_at: new Date().toISOString(),
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }
  if (payload.event === 'lead_magnet.schedule_failed') {
    const { leadMagnetId: failedId } = payload.data;
    if (!failedId) return { success: false, error: 'Missing leadMagnetId' };
    const { error } = await leadMagnetsRepo.updateLeadMagnetByIdUnscoped(failedId, {
      status: 'published',
      updated_at: new Date().toISOString(),
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }
  return { success: false, error: `Unknown event type: ${payload.event}` };
}

/** Handle DFY webhook: create_lead_magnet or trigger_autopilot. */
export async function handleDfy(payload: {
  action: string;
  userId: string;
  archetype?: string;
  businessContext?: Record<string, unknown>;
  engagementId?: string;
}) {
  if (payload.action === 'create_lead_magnet') {
    try {
      const ctx = payload.businessContext || {};
      const archetype = (payload.archetype || 'focused-toolkit') as string;
      const magnet = await leadMagnetsRepo.createLeadMagnet(payload.userId, null, {
        title: `DFY Lead Magnet — ${(ctx as { company?: string }).company || 'Client'}`,
        archetype,
        status: 'draft',
        metadata: {
          source: 'dfy_automation',
          engagement_id: payload.engagementId,
        },
      });
      const handle = await tasks.trigger('create-lead-magnet-pipeline', {
      userId: payload.userId,
      userName: null,
      username: null,
      archetype,
      businessContext: {
        businessDescription: (ctx as { businessDescription?: string }).businessDescription || `${(ctx as { company?: string }).company || 'Business'} in ${(ctx as { industry?: string }).industry || 'their industry'}`,
        credibilityMarkers: ((ctx as { credibilityMarkers?: string[] }).credibilityMarkers) || [],
        urgentPains: ((ctx as { urgentPains?: string[] }).urgentPains) || [],
        processes: ((ctx as { processes?: string[] }).processes) || [],
        tools: ((ctx as { tools?: string[] }).tools) || [],
        results: ((ctx as { results?: string[] }).results) || [],
        frequentQuestions: ((ctx as { frequentQuestions?: string[] }).frequentQuestions) || [],
      },
      autoPublishFunnel: false,
      autoSchedulePost: false,
      leadMagnetId: magnet.id,
    });
      return { success: true, leadMagnetId: magnet.id, runId: handle.id };
    } catch (err) {
      logError('webhooks/dfy', err, { step: 'create_lead_magnet_record' });
      return { success: false, error: err instanceof Error ? err.message : 'Failed to create lead magnet' };
    }
  }
  if (payload.action === 'trigger_autopilot') {
    const handle = await tasks.trigger('run-autopilot', {
      userId: payload.userId,
      postsPerBatch: 3,
      bufferTarget: 5,
      autoPublish: false,
    });
    return { success: true, runId: handle.id };
  }
  return { success: false, error: `Unknown action: ${payload.action}` };
}

/** Handle subscriber-sync webhook: merge and upsert email_subscribers. */
export async function handleSubscriberSync(payload: {
  email: string;
  team_id: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}) {
  const email = payload.email.trim().toLowerCase();
  const existing = await emailRepo.findSubscriberForSync(payload.team_id, email);
  const source = payload.source || 'gtm_sync';
  const upsertData: Record<string, unknown> = {
    email,
    source,
    status: 'active',
    first_name: payload.first_name?.trim() || existing?.first_name || null,
    last_name: payload.last_name?.trim() || existing?.last_name || null,
    company: payload.company?.trim() || existing?.company || null,
    metadata: { ...((existing?.metadata as Record<string, unknown>) || {}), ...(payload.metadata || {}) },
  };
  const { data: subscriber, error } = await emailRepo.upsertSubscriberSync(payload.team_id, upsertData);
  if (error) return { success: false, error: error.message };
  return { success: true, subscriber, merged: !!existing };
}

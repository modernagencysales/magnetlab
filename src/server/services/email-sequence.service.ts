/**
 * Email Sequence Service
 * Generate, get, update, and activate email sequences.
 */

import { generateEmailSequence, generateDefaultEmailSequence } from '@/lib/ai/email-sequence-generator';
import { logApiError } from '@/lib/api/errors';
import type { Email, EmailGenerationContext, EmailSequenceRow } from '@/lib/types/email';
import { emailSequenceFromRow } from '@/lib/types/email';
import type { DataScope } from '@/lib/utils/team-context';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { captureAndClassifyEdit } from '@/lib/services/edit-capture';
import * as emailSequenceRepo from '@/server/repositories/email-sequence.repo';

export async function generate(leadMagnetId: string, useAI: boolean, userId: string) {
  const { data: leadMagnet, error: lmError } = await emailSequenceRepo.getLeadMagnetForUser(leadMagnetId, userId);
  if (lmError || !leadMagnet) {
    return { success: false, error: 'not_found' as const, message: 'Lead magnet not found' };
  }

  const brandKit = await emailSequenceRepo.getBrandKitForUser(userId);
  const userName = await emailSequenceRepo.getUserName(userId);
  const senderName = brandKit?.sender_name || userName || 'Your Friend';

  const concept = leadMagnet.concept as { contents?: string; deliveryFormat?: string } | null;
  const extractedContent = leadMagnet.extracted_content as { title?: string; format?: string } | null;

  const context: EmailGenerationContext = {
    leadMagnetTitle: leadMagnet.title,
    leadMagnetFormat: extractedContent?.format || concept?.deliveryFormat || leadMagnet.archetype || '',
    leadMagnetContents: concept?.contents || extractedContent?.title || '',
    senderName,
    businessDescription: brandKit?.business_description || '',
    bestVideoUrl: brandKit?.best_video_url || undefined,
    bestVideoTitle: brandKit?.best_video_title || undefined,
    contentLinks: brandKit?.content_links as Array<{ title: string; url: string }> | undefined,
    communityUrl: brandKit?.community_url || undefined,
    audienceStyle: 'casual-direct',
  };

  let emails;
  if (useAI) {
    try {
      emails = await generateEmailSequence({ context });
    } catch (aiError) {
      logApiError('email-sequence/generate/ai', aiError, { leadMagnetId, note: 'Falling back to default' });
      emails = generateDefaultEmailSequence(leadMagnet.title, senderName);
    }
  } else {
    emails = generateDefaultEmailSequence(leadMagnet.title, senderName);
  }

  const { data: emailSequence, error: upsertError } = await emailSequenceRepo.upsertEmailSequence({
    leadMagnetId,
    userId,
    teamId: leadMagnet.team_id ?? null,
    emails,
    status: 'draft',
  });

  if (upsertError || !emailSequence) {
    logApiError('email-sequence/generate/save', upsertError, { leadMagnetId });
    return { success: false, error: 'database' as const, message: 'Failed to save email sequence' };
  }

  return {
    success: true,
    emailSequence: emailSequenceFromRow(emailSequence as EmailSequenceRow),
    generated: true,
  };
}

export async function getByLeadMagnetId(scope: DataScope, leadMagnetId: string) {
  const exists = await emailSequenceRepo.getLeadMagnetIdByScope(leadMagnetId, scope);
  if (!exists) {
    return { success: false, error: 'not_found' as const, message: 'Lead magnet not found' };
  }

  const { data, error } = await emailSequenceRepo.getEmailSequenceByLeadMagnetId(leadMagnetId, scope);
  if (error && error.code !== 'PGRST116') {
    logApiError('email-sequence/get', error, { leadMagnetId });
    return { success: false, error: 'database' as const, message: 'Failed to get email sequence' };
  }

  if (!data) {
    return { success: true, emailSequence: null };
  }
  return {
    success: true,
    emailSequence: emailSequenceFromRow(data as EmailSequenceRow),
  };
}

export async function update(
  scope: DataScope,
  leadMagnetId: string,
  payload: { emails?: Array<{ day: number; subject: string; body: string; replyTrigger: string }>; status?: string }
) {
  const { data: existingSequence, error: findError } = await emailSequenceRepo.getEmailSequenceForUpdate(leadMagnetId, scope);
  if (findError) {
    logApiError('email-sequence/update/find', findError, { leadMagnetId });
    return { success: false, error: 'database' as const, message: 'Failed to look up email sequence' };
  }
  if (!existingSequence) {
    return { success: false, error: 'not_found' as const, message: 'Email sequence not found' };
  }

  const updatePayload: { emails?: Email[]; status?: string } = {};
  if (payload.emails) {
    updatePayload.emails = payload.emails;
    updatePayload.status = 'draft';
  } else if (payload.status) {
    updatePayload.status = payload.status;
  }

  const { data: updated, error } = await emailSequenceRepo.updateEmailSequenceById(
    existingSequence.id,
    updatePayload,
    scope
  );
  if (error) {
    logApiError('email-sequence/update', error, { leadMagnetId });
    return { success: false, error: 'database' as const, message: 'Failed to update email sequence' };
  }

  // Edit capture (async, never blocks)
  if (payload.emails && scope.teamId && existingSequence.emails && Array.isArray(existingSequence.emails)) {
    const supabase = createSupabaseAdminClient();
    const oldEmails = existingSequence.emails as Array<{ subject: string; body: string }>;
    const newEmails = payload.emails;
    for (let i = 0; i < newEmails.length; i++) {
      const oldEmail = oldEmails[i];
      const newEmail = newEmails[i];
      if (oldEmail && newEmail) {
        if (oldEmail.subject !== newEmail.subject) {
          captureAndClassifyEdit(supabase, {
            teamId: scope.teamId,
            profileId: null,
            contentType: 'sequence',
            contentId: existingSequence.id,
            fieldName: `email_${i}_subject`,
            originalText: oldEmail.subject,
            editedText: newEmail.subject,
          }).catch(() => {});
        }
        if (oldEmail.body !== newEmail.body) {
          captureAndClassifyEdit(supabase, {
            teamId: scope.teamId,
            profileId: null,
            contentType: 'sequence',
            contentId: existingSequence.id,
            fieldName: `email_${i}_body`,
            originalText: oldEmail.body,
            editedText: newEmail.body,
          }).catch(() => {});
        }
      }
    }
  }

  return {
    success: true,
    emailSequence: emailSequenceFromRow(updated as EmailSequenceRow),
  };
}

export async function activate(userId: string, leadMagnetId: string) {
  const { data: sequenceData, error: seqError } = await emailSequenceRepo.getEmailSequenceByLeadMagnetIdForUser(leadMagnetId, userId);
  if (seqError || !sequenceData) {
    return { success: false, error: 'not_found' as const, message: 'Email sequence not found' };
  }

  const sequence = emailSequenceFromRow(sequenceData as EmailSequenceRow);
  if (!sequence.emails || sequence.emails.length === 0) {
    return { success: false, error: 'validation' as const, message: 'No emails in sequence. Generate emails first.' };
  }

  const { data: updatedSequence, error: updateError } = await emailSequenceRepo.setEmailSequenceStatusActive(sequence.id, userId);
  if (updateError) {
    logApiError('email-sequence/activate', updateError, { leadMagnetId });
    return { success: false, error: 'database' as const, message: 'Failed to activate sequence' };
  }

  return {
    success: true,
    emailSequence: emailSequenceFromRow(updatedSequence as EmailSequenceRow),
    message: 'Email sequence activated! New leads will automatically receive the welcome sequence.',
    posthogPayload: { lead_magnet_id: leadMagnetId, email_count: sequence.emails.length },
  };
}

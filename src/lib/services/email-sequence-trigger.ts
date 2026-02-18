// Email Sequence Trigger Service
// Triggers email sequences via Trigger.dev when leads opt in

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { scheduleEmailSequence } from '@/trigger/email-sequence';
import { logError, logInfo } from '@/lib/utils/logger';
import type { EmailSequenceRow } from '@/lib/types/email';
import type { ResendConfig } from '@/lib/integrations/resend';

export interface TriggerEmailSequenceInput {
  leadId: string;
  userId: string;
  email: string;
  name: string | null;
  leadMagnetId: string;
  leadMagnetTitle: string;
}

/**
 * Check if email sequence should be triggered:
 * 1. Email sequence exists and is active for this lead magnet
 */
async function shouldTriggerSequence(
  userId: string,
  leadMagnetId: string
): Promise<{ shouldTrigger: boolean; sequence?: EmailSequenceRow }> {
  const supabase = createSupabaseAdminClient();

  // Check if email sequence exists and is active
  const { data: sequence } = await supabase
    .from('email_sequences')
    .select('id, lead_magnet_id, user_id, emails, status, created_at, updated_at')
    .eq('lead_magnet_id', leadMagnetId)
    .eq('user_id', userId)
    .single();

  // Only trigger if sequence status is 'active'
  if (sequence?.status === 'active' && sequence.emails?.length > 0) {
    return { shouldTrigger: true, sequence: sequence as EmailSequenceRow };
  }

  return { shouldTrigger: false };
}

/**
 * Get sender info from brand kit + team email domain
 */
async function getSenderInfo(userId: string): Promise<{ senderName: string; senderEmail?: string }> {
  const supabase = createSupabaseAdminClient();

  // Run brand kit and team lookups in parallel
  const [brandKitResult, teamResult] = await Promise.all([
    supabase
      .from('brand_kits')
      .select('sender_name')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('teams')
      .select('id, custom_email_sender_name, custom_from_email')
      .eq('owner_id', userId)
      .limit(1)
      .single(),
  ]);

  const brandKit = brandKitResult.data;
  const team = teamResult.data;

  // Check if team has a verified email domain
  let hasVerifiedDomain = false;
  if (team?.id) {
    try {
      const { data: emailDomain } = await supabase
        .from('team_email_domains')
        .select('id, domain, status')
        .eq('team_id', team.id)
        .eq('status', 'verified')
        .single();

      hasVerifiedDomain = !!emailDomain;
    } catch {
      // No verified domain found (PGRST116) or other error — fall back to defaults
    }
  }

  return {
    senderName: team?.custom_email_sender_name || brandKit?.sender_name || 'MagnetLab',
    senderEmail: hasVerifiedDomain && team?.custom_from_email ? team.custom_from_email : undefined,
  };
}

/**
 * Get user's Resend configuration if they have connected their own account
 */
async function getUserResendConfig(userId: string): Promise<ResendConfig | undefined> {
  try {
    const integration = await getUserIntegration(userId, 'resend');

    if (!integration?.is_active || !integration.api_key) {
      return undefined;
    }

    const metadata = integration.metadata as { fromEmail?: string; fromName?: string } | undefined;

    return {
      apiKey: integration.api_key,
      fromEmail: metadata?.fromEmail,
      fromName: metadata?.fromName,
    };
  } catch (error) {
    logError('email-sequence/resend-config', error, { userId });
    return undefined;
  }
}

/**
 * Trigger email sequence for a lead
 * Called after a lead is captured
 */
export async function triggerEmailSequenceIfActive(
  input: TriggerEmailSequenceInput
): Promise<{ triggered: boolean; error?: string }> {
  try {
    // Check if sequence should be triggered
    const { shouldTrigger, sequence } = await shouldTriggerSequence(
      input.userId,
      input.leadMagnetId
    );

    if (!shouldTrigger || !sequence) {
      return { triggered: false };
    }

    // Parallelize getting sender info and Resend config
    const [senderInfo, resendConfig] = await Promise.all([
      getSenderInfo(input.userId),
      getUserResendConfig(input.userId),
    ]);

    const { senderName, senderEmail } = senderInfo;

    // Trigger the email sequence via Trigger.dev
    await scheduleEmailSequence.trigger({
      leadId: input.leadId,
      leadEmail: input.email,
      leadName: input.name,
      leadMagnetId: input.leadMagnetId,
      leadMagnetTitle: input.leadMagnetTitle,
      senderName: resendConfig?.fromName || senderName,
      senderEmail: resendConfig?.fromEmail || senderEmail,
      emails: sequence.emails,
      resendConfig,
    });

    logInfo('email-sequence/trigger', 'Email sequence triggered', {
      leadEmail: input.email,
      customResend: !!resendConfig
    });
    return { triggered: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logError('email-sequence/trigger', error, { leadId: input.leadId });
    return { triggered: false, error: errorMessage };
  }
}

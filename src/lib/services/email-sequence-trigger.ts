// Email Sequence Trigger Service
// Triggers email sequences via Trigger.dev when leads opt in

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { scheduleEmailSequence } from '@/trigger/email-sequence';
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
    .select('*')
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
 * Get sender info from brand kit
 */
async function getSenderInfo(userId: string): Promise<{ senderName: string; senderEmail?: string }> {
  const supabase = createSupabaseAdminClient();

  const { data: brandKit } = await supabase
    .from('brand_kits')
    .select('sender_name')
    .eq('user_id', userId)
    .single();

  return {
    senderName: brandKit?.sender_name || 'MagnetLab',
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
    console.error('Error fetching user Resend config:', error);
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

    // Get sender info from brand kit
    const { senderName, senderEmail } = await getSenderInfo(input.userId);

    // Get user's Resend config if they have their own account connected
    const resendConfig = await getUserResendConfig(input.userId);

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

    console.log(`Email sequence triggered for lead ${input.email}${resendConfig ? ' (using custom Resend account)' : ''}`);
    return { triggered: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Email sequence trigger error:', errorMessage);
    return { triggered: false, error: errorMessage };
  }
}

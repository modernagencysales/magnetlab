/**
 * Integrations Repository
 * All Supabase access for Resend settings, email-marketing connected list, and funnel_integrations deactivation.
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

const RESEND_SERVICE = 'resend';

export async function getResendIntegration(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('user_integrations')
    .select('id, metadata')
    .eq('user_id', userId)
    .eq('service', RESEND_SERVICE)
    .single();
  return { data, error };
}

export async function updateResendIntegrationMetadata(
  integrationId: string,
  metadata: Record<string, unknown>
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('user_integrations')
    .update({
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', integrationId);
  return { error };
}

export async function getActiveEmailMarketingServiceNames(
  userId: string,
  services: readonly string[]
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('user_integrations')
    .select('service')
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('service', [...services]);
  if (error) return { data: null, error };
  return { data: (data ?? []).map((r) => r.service), error: null };
}

export async function deactivateFunnelIntegrationsForProvider(userId: string, provider: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('funnel_integrations')
    .update({ is_active: false })
    .eq('user_id', userId)
    .eq('provider', provider);
  return { error };
}

/** Get Fathom integration webhook secret for a user (for webhook auth). */
export async function getFathomIntegration(userId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('user_integrations')
    .select('webhook_secret, is_active')
    .eq('user_id', userId)
    .eq('service', 'fathom')
    .single();
  if (error || !data) return null;
  return data;
}

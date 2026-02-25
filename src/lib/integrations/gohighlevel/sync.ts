// GoHighLevel Lead Sync — fire-and-forget
// Syncs a funnel lead to the user's GHL account if both account-level
// and funnel-level integrations are active.

import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { GoHighLevelClient } from './client';
import type { GHLContactPayload, GHLSyncParams } from './types';

/**
 * Sync a captured lead to GoHighLevel.
 *
 * This is fire-and-forget: errors are logged but never thrown,
 * so it can be called without blocking the lead capture response.
 */
export async function syncLeadToGoHighLevel(params: GHLSyncParams): Promise<void> {
  try {
    const { userId, funnelPageId, lead, leadMagnetTitle, funnelSlug } = params;

    // 1. Check account-level connection
    const integration = await getUserIntegration(userId, 'gohighlevel');
    if (!integration || !integration.api_key || !integration.is_active) {
      return;
    }

    // 2. Check funnel-level toggle
    const supabase = createSupabaseAdminClient();
    const { data: funnelIntegration, error } = await supabase
      .from('funnel_integrations')
      .select('id, funnel_page_id, provider, is_active, settings')
      .eq('provider', 'gohighlevel')
      .eq('funnel_page_id', funnelPageId)
      .single();

    if (error || !funnelIntegration || !funnelIntegration.is_active) {
      return;
    }

    // 3. Build tags array
    const tags: string[] = [leadMagnetTitle, funnelSlug, 'magnetlab'];
    const settings = funnelIntegration.settings as Record<string, unknown> | null;
    if (settings?.custom_tags && Array.isArray(settings.custom_tags)) {
      tags.push(...(settings.custom_tags as string[]));
    }

    // 4. Build customField record from UTMs + qualification data
    const customField: Record<string, string> = {};
    if (lead.utmSource) customField.utm_source = lead.utmSource;
    if (lead.utmMedium) customField.utm_medium = lead.utmMedium;
    if (lead.utmCampaign) customField.utm_campaign = lead.utmCampaign;
    if (lead.isQualified != null) customField.qualified = String(lead.isQualified);
    if (lead.qualificationAnswers) {
      for (const [key, value] of Object.entries(lead.qualificationAnswers)) {
        customField[`qa_${key}`] = value;
      }
    }

    // 5. Build payload and create contact
    const payload: GHLContactPayload = {
      email: lead.email,
      ...(lead.name ? { name: lead.name } : {}),
      tags,
      source: 'magnetlab',
      customField,
    };

    const client = new GoHighLevelClient(integration.api_key);
    const result = await client.createContact(payload);

    if (!result.success) {
      console.error('[GHL sync] createContact failed:', result.error);
    }
  } catch (err) {
    console.error('[GHL sync] Unexpected error:', err instanceof Error ? err.message : err);
  }
}

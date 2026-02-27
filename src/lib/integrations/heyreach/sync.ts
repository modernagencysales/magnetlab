// HeyReach Lead Sync — fire-and-forget
// Syncs a funnel lead to a HeyReach campaign if both account-level
// and funnel-level integrations are active.

import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { HeyReachClient } from './client';
import type { HeyReachSyncParams } from './types';

/**
 * Sync a captured lead to HeyReach.
 *
 * This is fire-and-forget: errors are logged but never thrown,
 * so it can be called without blocking the lead capture response.
 */
export async function syncLeadToHeyReach(params: HeyReachSyncParams): Promise<void> {
  try {
    const { userId, funnelPageId, lead, leadMagnetTitle, leadMagnetUrl, funnelSlug } = params;

    // 1. Check account-level connection
    const integration = await getUserIntegration(userId, 'heyreach');
    if (!integration || !integration.api_key || !integration.is_active) {
      return;
    }

    // 2. Check funnel-level toggle
    const supabase = createSupabaseAdminClient();
    const { data: funnelIntegration, error } = await supabase
      .from('funnel_integrations')
      .select('id, funnel_page_id, provider, is_active, settings')
      .eq('provider', 'heyreach')
      .eq('funnel_page_id', funnelPageId)
      .single();

    if (error || !funnelIntegration || !funnelIntegration.is_active) {
      return;
    }

    // 3. Get campaign ID from funnel settings
    const settings = funnelIntegration.settings as Record<string, unknown> | null;
    const campaignId = settings?.campaign_id as number | undefined;
    if (!campaignId) {
      console.error('[HeyReach sync] No campaign_id configured for funnel', funnelPageId);
      return;
    }

    // 4. Build custom fields
    const customFields: Record<string, string> = {
      lead_magnet_title: leadMagnetTitle,
      lead_magnet_url: leadMagnetUrl,
    };
    if (lead.utmSource) customFields.utm_source = lead.utmSource;
    if (lead.utmMedium) customFields.utm_medium = lead.utmMedium;
    if (lead.utmCampaign) customFields.utm_campaign = lead.utmCampaign;

    // 5. Split name into first/last
    const nameParts = (lead.name || '').trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // 6. Push to HeyReach
    const client = new HeyReachClient(integration.api_key);
    const result = await client.addContactsToCampaign(campaignId, [
      {
        linkedinUrl: lead.linkedinUrl || undefined,
        firstName,
        lastName,
        email: lead.email,
        customFields,
      },
    ]);

    // 7. Update delivery status on the lead (best-effort)
    const status = result.success ? 'sent' : 'failed';
    await supabase
      .from('funnel_leads')
      .update({ heyreach_delivery_status: status })
      .eq('funnel_page_id', funnelPageId)
      .eq('email', lead.email)
      .catch(() => {});

    if (!result.success) {
      console.error('[HeyReach sync] addContactsToCampaign failed:', result.error);
    }
  } catch (err) {
    console.error('[HeyReach sync] Unexpected error:', err instanceof Error ? err.message : err);
  }
}

import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { KajabiClient } from './client';
import type { KajabiSyncParams } from './types';

/**
 * Sync a captured lead to Kajabi.
 *
 * Fire-and-forget: errors are logged but never thrown,
 * so it can be called without blocking the lead capture response.
 */
export async function syncLeadToKajabi(params: KajabiSyncParams): Promise<void> {
  try {
    const { userId, funnelPageId, lead } = params;

    // 1. Check account-level connection
    const integration = await getUserIntegration(userId, 'kajabi');
    if (!integration || !integration.api_key || !integration.is_active) {
      return;
    }

    const siteId = (integration.metadata as { site_id?: string })?.site_id;
    if (!siteId) {
      return;
    }

    // 2. Check funnel-level toggle
    const supabase = createSupabaseAdminClient();
    const { data: funnelIntegration, error } = await supabase
      .from('funnel_integrations')
      .select('id, is_active, settings')
      .eq('provider', 'kajabi')
      .eq('funnel_page_id', funnelPageId)
      .single();

    if (error || !funnelIntegration || !funnelIntegration.is_active) {
      return;
    }

    // 3. Create contact
    const client = new KajabiClient(integration.api_key, siteId);
    const { id: contactId } = await client.createContact(
      lead.email,
      lead.name || undefined
    );

    // 4. Apply tags if configured
    const settings = funnelIntegration.settings as { tag_ids?: string[] } | null;
    if (settings?.tag_ids && settings.tag_ids.length > 0) {
      await client.addTagsToContact(contactId, settings.tag_ids);
    }
  } catch (err) {
    console.error('[Kajabi sync] Unexpected error:', err instanceof Error ? err.message : err);
  }
}

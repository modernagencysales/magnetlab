import type {
  EmailMarketingProvider,
  EmailMarketingProviderName,
  ProviderCredentials,
} from './types';
import { KitProvider } from './providers/kit';
import { MailerLiteProvider } from './providers/mailerlite';
import { MailchimpProvider } from './providers/mailchimp';
import { ActiveCampaignProvider } from './providers/activecampaign';
import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

export { type EmailMarketingProvider, type EmailMarketingProviderName } from './types';

export const EMAIL_MARKETING_PROVIDERS = ['kit', 'mailerlite', 'mailchimp', 'activecampaign'] as const;

export function isEmailMarketingProvider(s: string): s is EmailMarketingProviderName {
  return (EMAIL_MARKETING_PROVIDERS as readonly string[]).includes(s);
}

export function getEmailMarketingProvider(
  provider: string,
  credentials: ProviderCredentials
): EmailMarketingProvider {
  switch (provider) {
    case 'kit':
      return new KitProvider(credentials);
    case 'mailerlite':
      return new MailerLiteProvider(credentials);
    case 'mailchimp':
      return new MailchimpProvider(credentials);
    case 'activecampaign':
      return new ActiveCampaignProvider(credentials);
    default:
      throw new Error(`Unknown email marketing provider: ${provider}`);
  }
}

/**
 * Fire-and-forget: sync a new lead to all active email marketing integrations
 * configured for this funnel page.
 */
export async function syncLeadToEmailProviders(
  funnelPageId: string,
  lead: { email: string; name?: string | null }
): Promise<void> {
  // Admin client required: this runs in public lead capture context (no auth session).
  // RLS on funnel_integrations ensures only the funnel owner can create/modify rows.
  const supabase = createSupabaseAdminClient();

  const { data: mappings } = await supabase
    .from('funnel_integrations')
    .select('provider, list_id, tag_id, user_id')
    .eq('funnel_page_id', funnelPageId)
    .eq('is_active', true);

  if (!mappings?.length) return;

  const results = await Promise.allSettled(
    mappings.map(async (mapping) => {
      const integration = await getUserIntegration(mapping.user_id, mapping.provider);
      if (!integration?.api_key) return;

      const provider = getEmailMarketingProvider(mapping.provider, {
        apiKey: integration.api_key,
        metadata: (integration.metadata ?? {}) as Record<string, string>,
      });

      const result = await provider.subscribe({
        listId: mapping.list_id,
        email: lead.email,
        firstName: lead.name?.split(' ')[0] ?? undefined,
        tagId: mapping.tag_id ?? undefined,
      });

      if (!result.success) {
        console.error(
          `[email-marketing] ${mapping.provider} subscribe failed for ${lead.email}:`,
          result.error
        );
      }
    })
  );

  for (const r of results) {
    if (r.status === 'rejected') {
      console.error('[email-marketing] Unexpected error:', r.reason);
    }
  }
}

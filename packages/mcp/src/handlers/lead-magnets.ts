import { MagnetLabClient } from '../client.js';
import type { Archetype, LeadMagnetStatus, FunnelTheme, BackgroundStyle } from '../constants.js';

/** Generate URL-safe slug from a title. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);
}

/**
 * Handle lead magnet related tool calls.
 */
export async function handleLeadMagnetTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_list_lead_magnets':
      return client.listLeadMagnets({
        status: args.status as LeadMagnetStatus | undefined,
        limit: args.limit as number | undefined,
        offset: args.offset as number | undefined,
      });

    case 'magnetlab_get_lead_magnet':
      return client.getLeadMagnet(args.id as string);

    case 'magnetlab_create_lead_magnet': {
      const leadMagnet = await client.createLeadMagnet({
        title: args.title as string,
        archetype: args.archetype as Archetype,
        concept: args.concept as unknown,
      });

      const funnelConfig = args.funnel_config as Record<string, unknown> | undefined;
      if (!funnelConfig) {
        return leadMagnet;
      }

      // Extract lead magnet ID from response
      const lmId = (leadMagnet as Record<string, unknown>).id as string;
      if (!lmId) {
        return {
          ...(leadMagnet as Record<string, unknown>),
          funnel_error: 'Could not extract lead magnet ID',
        };
      }

      const slug = (funnelConfig.slug as string) || slugify(args.title as string);
      const shouldPublish = funnelConfig.publish === true;

      try {
        const funnelResult = await client.createFunnel({
          leadMagnetId: lmId,
          slug,
          optinHeadline: funnelConfig.optin_headline as string | undefined,
          optinSubline: funnelConfig.optin_subline as string | undefined,
          optinButtonText: funnelConfig.optin_button_text as string | undefined,
          optinSocialProof: funnelConfig.optin_social_proof as string | undefined,
          thankyouHeadline: funnelConfig.thankyou_headline as string | undefined,
          thankyouSubline: funnelConfig.thankyou_subline as string | undefined,
          theme: funnelConfig.theme as FunnelTheme | undefined,
          primaryColor: funnelConfig.primary_color as string | undefined,
          backgroundStyle: funnelConfig.background_style as BackgroundStyle | undefined,
          vslUrl: funnelConfig.vsl_url as string | undefined,
          calendlyUrl: funnelConfig.calendly_url as string | undefined,
          logoUrl: funnelConfig.logo_url as string | undefined,
          qualificationFormId: funnelConfig.qualification_form_id as string | undefined,
        });

        const funnelData = funnelResult as Record<string, unknown>;
        let publishResult: { publicUrl?: string | null } | undefined;

        if (shouldPublish) {
          const funnelId =
            ((funnelData.funnel as Record<string, unknown>)?.id as string) ||
            (funnelData.id as string);
          if (funnelId) {
            try {
              publishResult = (await client.publishFunnel(funnelId)) as {
                publicUrl?: string | null;
              };
            } catch (publishErr) {
              return {
                lead_magnet: leadMagnet,
                funnel: funnelData,
                publish_error: publishErr instanceof Error ? publishErr.message : 'Publish failed',
              };
            }
          }
        }

        return {
          lead_magnet: leadMagnet,
          funnel: funnelData,
          ...(publishResult?.publicUrl ? { public_url: publishResult.publicUrl } : {}),
        };
      } catch (funnelErr) {
        return {
          lead_magnet: leadMagnet,
          funnel_error: funnelErr instanceof Error ? funnelErr.message : 'Funnel creation failed',
        };
      }
    }

    case 'magnetlab_delete_lead_magnet':
      return client.deleteLeadMagnet(args.id as string);

    case 'magnetlab_get_lead_magnet_stats':
      return client.getLeadMagnetStats(args.lead_magnet_id as string);

    case 'magnetlab_analyze_competitor':
      return client.analyzeCompetitor({ url: args.url as string });

    case 'magnetlab_generate_lead_magnet_posts':
      return client.generateLeadMagnetPosts(args.lead_magnet_id as string);

    case 'magnetlab_analyze_transcript':
      return client.analyzeTranscript({ transcript: args.transcript as string });

    default:
      throw new Error(`Unknown lead magnet tool: ${name}`);
  }
}

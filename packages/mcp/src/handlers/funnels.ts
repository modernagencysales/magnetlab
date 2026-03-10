import { MagnetLabClient } from '../client.js';
import type { FunnelTheme, BackgroundStyle, FunnelTargetType } from '../constants.js';

/**
 * Handle funnel related tool calls.
 */
export async function handleFunnelTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_list_funnels':
      return client.listFunnels({
        limit: args.limit as number | undefined,
        offset: args.offset as number | undefined,
      });

    case 'magnetlab_get_funnel':
      return client.getFunnel(args.id as string);

    case 'magnetlab_get_funnel_by_target':
      return client.getFunnelByTarget({
        leadMagnetId: args.lead_magnet_id as string | undefined,
        libraryId: args.library_id as string | undefined,
        externalResourceId: args.external_resource_id as string | undefined,
      });

    case 'magnetlab_create_funnel':
      return client.createFunnel({
        leadMagnetId: args.lead_magnet_id as string | undefined,
        libraryId: args.library_id as string | undefined,
        externalResourceId: args.external_resource_id as string | undefined,
        targetType: args.target_type as FunnelTargetType | undefined,
        slug: args.slug as string,
        optinHeadline: args.optin_headline as string | undefined,
        optinSubline: args.optin_subline as string | undefined,
        optinButtonText: args.optin_button_text as string | undefined,
        optinSocialProof: args.optin_social_proof as string | undefined,
        thankyouHeadline: args.thankyou_headline as string | undefined,
        thankyouSubline: args.thankyou_subline as string | undefined,
        vslUrl: args.vsl_url as string | undefined,
        calendlyUrl: args.calendly_url as string | undefined,
        theme: args.theme as FunnelTheme | undefined,
        primaryColor: args.primary_color as string | undefined,
        backgroundStyle: args.background_style as BackgroundStyle | undefined,
        logoUrl: args.logo_url as string | undefined,
        qualificationFormId: args.qualification_form_id as string | undefined,
      });

    case 'magnetlab_update_funnel':
      return client.updateFunnel(args.id as string, {
        slug: args.slug as string | undefined,
        optinHeadline: args.optin_headline as string | undefined,
        optinSubline: args.optin_subline as string | undefined,
        optinButtonText: args.optin_button_text as string | undefined,
        optinSocialProof: args.optin_social_proof as string | undefined,
        thankyouHeadline: args.thankyou_headline as string | undefined,
        thankyouSubline: args.thankyou_subline as string | undefined,
        vslUrl: args.vsl_url as string | undefined,
        calendlyUrl: args.calendly_url as string | undefined,
        theme: args.theme as FunnelTheme | undefined,
        primaryColor: args.primary_color as string | undefined,
        backgroundStyle: args.background_style as BackgroundStyle | undefined,
        logoUrl: args.logo_url as string | undefined,
        qualificationFormId: args.qualification_form_id as string | null | undefined,
        qualificationPassMessage: args.qualification_pass_message as string | undefined,
        qualificationFailMessage: args.qualification_fail_message as string | undefined,
        redirectTrigger: args.redirect_trigger as string | undefined,
        redirectUrl: args.redirect_url as string | null | undefined,
        redirectFailUrl: args.redirect_fail_url as string | null | undefined,
        homepageUrl: args.homepage_url as string | null | undefined,
        homepageLabel: args.homepage_label as string | null | undefined,
        sendResourceEmail: args.send_resource_email as boolean | undefined,
      });

    case 'magnetlab_delete_funnel':
      return client.deleteFunnel(args.id as string);

    case 'magnetlab_publish_funnel': {
      const publishResult = await client.publishFunnel(args.id as string);

      // Check for draft email sequence and warn
      try {
        const funnelData = publishResult as { funnel?: Record<string, unknown> };
        const leadMagnetId =
          (funnelData.funnel?.lead_magnet_id as string) ||
          (funnelData.funnel?.leadMagnetId as string);

        if (leadMagnetId) {
          const seqResult = (await client.getEmailSequence(leadMagnetId)) as {
            emailSequence?: { status?: string } | null;
          };

          if (seqResult?.emailSequence && seqResult.emailSequence.status !== 'active') {
            return {
              ...(publishResult as Record<string, unknown>),
              warning:
                'This funnel has an email sequence in "' +
                (seqResult.emailSequence.status || 'draft') +
                '" state. Leads who opt in will NOT receive sequence emails. ' +
                'Call magnetlab_activate_email_sequence to start sending.',
            };
          }
        }
      } catch (err) {
        console.warn('Sequence check failed during publish:', err);
      }

      return publishResult;
    }

    case 'magnetlab_unpublish_funnel':
      return client.unpublishFunnel(args.id as string);

    case 'magnetlab_generate_funnel_content':
      return client.generateFunnelContent({ leadMagnetId: args.lead_magnet_id as string });

    case 'magnetlab_list_sections':
      return client.listSections(args.funnel_id as string);

    case 'magnetlab_create_section':
      return client.createSection(args.funnel_id as string, {
        sectionType: args.section_type as string,
        pageLocation: args.page_location as string,
        variant: args.variant as string | undefined,
        sortOrder: args.sort_order as number | undefined,
        isVisible: args.is_visible as boolean | undefined,
        config: args.config as Record<string, unknown>,
      });

    case 'magnetlab_update_section':
      return client.updateSection(args.funnel_id as string, args.section_id as string, {
        variant: args.variant as string | undefined,
        sortOrder: args.sort_order as number | undefined,
        isVisible: args.is_visible as boolean | undefined,
        pageLocation: args.page_location as string | undefined,
        config: args.config as Record<string, unknown> | undefined,
      });

    case 'magnetlab_delete_section':
      return client.deleteSection(args.funnel_id as string, args.section_id as string);

    case 'magnetlab_restyle_funnel':
      return client.restyleFunnel(args.funnel_id as string, {
        prompt: args.prompt as string | undefined,
        urls: args.urls as string[] | undefined,
      });

    case 'magnetlab_apply_restyle':
      return client.applyRestyle(args.funnel_id as string, {
        plan: args.plan as unknown,
      });

    default:
      throw new Error(`Unknown funnel tool: ${name}`);
  }
}

import { MagnetLabClient } from '../client.js'
import type { FunnelTheme, BackgroundStyle, FunnelTargetType } from '../constants.js'

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
      return client.listFunnels()

    case 'magnetlab_get_funnel':
      return client.getFunnel(args.id as string)

    case 'magnetlab_get_funnel_by_target':
      return client.getFunnelByTarget({
        leadMagnetId: args.lead_magnet_id as string | undefined,
        libraryId: args.library_id as string | undefined,
        externalResourceId: args.external_resource_id as string | undefined,
      })

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
      })

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
      })

    case 'magnetlab_delete_funnel':
      return client.deleteFunnel(args.id as string)

    case 'magnetlab_publish_funnel':
      return client.publishFunnel(args.id as string)

    case 'magnetlab_unpublish_funnel':
      return client.unpublishFunnel(args.id as string)

    case 'magnetlab_generate_funnel_content':
      return client.generateFunnelContent({ leadMagnetId: args.lead_magnet_id as string })

    default:
      throw new Error(`Unknown funnel tool: ${name}`)
  }
}

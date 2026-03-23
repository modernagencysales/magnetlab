/** Lead magnet post handler. Dispatches 3 lead magnet post tools to MagnetLabClient methods. Never imports HTTP or DB directly. */

import type { MagnetLabClient } from '../client.js';

export async function handleLeadMagnetPostTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_list_sender_accounts':
      return client.listSenderAccounts();

    case 'magnetlab_publish_linkedin_post':
      return client.publishLinkedInPost(args.team_profile_id as string, args.post_text as string);

    case 'magnetlab_launch_lead_magnet_post':
      return client.launchLeadMagnetPost({
        team_profile_id: args.team_profile_id as string,
        post_text: args.post_text as string,
        funnel_page_id: args.funnel_page_id as string | undefined,
        keywords: args.keywords as string[] | undefined,
        dm_template: args.dm_template as string | undefined,
        campaign_name: args.campaign_name as string | undefined,
      });

    default:
      throw new Error(`Unknown lead magnet post tool: ${name}`);
  }
}

/** Post campaign handler. Dispatches 8 post campaign tools to MagnetLabClient methods. Never imports HTTP or DB directly. */

import type { MagnetLabClient } from '../client.js';
import type { PostCampaignStatus } from '../constants.js';

export async function handlePostCampaignTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_list_post_campaigns':
      return client.listPostCampaigns(args.status as PostCampaignStatus | undefined);

    case 'magnetlab_create_post_campaign':
      return client.createPostCampaign({
        name: args.name as string,
        post_url: args.post_url as string,
        keywords: args.keywords as string[],
        unipile_account_id: args.unipile_account_id as string,
        dm_template: args.dm_template as string,
        funnel_page_id: args.funnel_page_id as string | undefined,
        reply_template: args.reply_template as string | undefined,
        poster_account_id: args.poster_account_id as string | undefined,
        target_locations: args.target_locations as string[] | undefined,
        auto_accept_connections: args.auto_accept_connections as boolean | undefined,
        auto_like_comments: args.auto_like_comments as boolean | undefined,
        auto_connect_non_requesters: args.auto_connect_non_requesters as boolean | undefined,
      });

    case 'magnetlab_auto_setup_post_campaign':
      return client.autoSetupPostCampaign(args.post_id as string);

    case 'magnetlab_get_post_campaign':
      return client.getPostCampaign(args.campaign_id as string);

    case 'magnetlab_update_post_campaign': {
      const { campaign_id, ...updates } = args;
      return client.updatePostCampaign(campaign_id as string, updates);
    }

    case 'magnetlab_activate_post_campaign':
      return client.activatePostCampaign(args.campaign_id as string);

    case 'magnetlab_pause_post_campaign':
      return client.pausePostCampaign(args.campaign_id as string);

    case 'magnetlab_delete_post_campaign':
      return client.deletePostCampaign(args.campaign_id as string);

    default:
      throw new Error(`Unknown post campaign tool: ${name}`);
  }
}

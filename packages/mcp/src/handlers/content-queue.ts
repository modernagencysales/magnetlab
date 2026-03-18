/** Content queue handler. Dispatches 6 content queue tools to MagnetLabClient methods. Never imports HTTP or DB directly. */

import type { MagnetLabClient } from '../client.js';

export async function handleContentQueueTools(
  name: string,
  args: Record<string, unknown>,
  client: MagnetLabClient
): Promise<unknown> {
  switch (name) {
    case 'magnetlab_list_content_queue':
      return client.listContentQueue();

    case 'magnetlab_update_queue_post':
      return client.updateQueuePost(args.post_id as string, {
        draft_content: args.draft_content as string | undefined,
        mark_edited: args.mark_edited as boolean | undefined,
      });

    case 'magnetlab_submit_queue_batch':
      return client.submitQueueBatch(args.team_id as string);

    case 'magnetlab_review_lead_magnet':
      return client.reviewLeadMagnet(args.lead_magnet_id as string, args.reviewed as boolean);

    case 'magnetlab_review_funnel':
      return client.reviewFunnel(args.funnel_id as string, args.reviewed as boolean);

    case 'magnetlab_submit_asset_review':
      return client.submitAssetReview(args.team_id as string);

    default:
      throw new Error(`Unknown content queue tool: ${name}`);
  }
}
